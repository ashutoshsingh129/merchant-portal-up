import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import Stripe from 'stripe';
import { PaymentIntent } from '../../datastore/models/payment-intent.model';
import { Charge } from '../../datastore/models/charge.model';
import { pool } from '../../utilities/dbconfig';
import { StripeService } from './stripe.service';

@Injectable()
export class StripeSyncService implements OnModuleInit {
  private syncInterval: NodeJS.Timeout | null = null;
  private fullSyncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 60000; // Sync every 60 seconds (new records only)
  private readonly FULL_SYNC_INTERVAL_MS = 3600000; // Full sync every hour (all records check)

  constructor(
    @InjectRepository(PaymentIntent)
    private paymentIntentRepository: Repository<PaymentIntent>,
    @InjectRepository(Charge)
    private chargeRepository: Repository<Charge>,
    private stripeService: StripeService,
  ) {}

  async onModuleInit() {
    // Start background sync after module initialization
    // Add a small delay to ensure all modules are fully loaded
    setTimeout(() => {
      this.startBackgroundSync();
    }, 5000); // Wait 5 seconds for all modules to initialize
  }

  /**
   * Get Stripe instance for a user (similar to StripeService)
   */
  private async getStripeInstanceForUser(userId: number): Promise<Stripe> {
    // Access the private method through a workaround - we'll need to expose it
    // For now, let's duplicate the logic or create a shared method
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT secret_key FROM stripe_keys WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
        [userId],
      );

      if (result.rows.length === 0) {
        throw new Error('No Stripe keys configured for this user');
      }

      const { secret_key: encryptedSecretKey } = result.rows[0];
      const { decrypt } = require('../../utilities/encryption');
      const decryptedSecretKey = decrypt(encryptedSecretKey);

      return new Stripe(decryptedSecretKey);
    } finally {
      client.release();
    }
  }

  /**
   * Extract customer info from Stripe object
   */
  private extractCustomerInfo(stripeObject: any): {
    id?: string;
    email?: string;
  } {
    let customerId: string | undefined;
    let customerEmail: string | undefined;

    if (stripeObject.customer) {
      if (typeof stripeObject.customer === 'string') {
        customerId = stripeObject.customer;
        customerEmail =
          stripeObject.receipt_email ||
          stripeObject.billing_details?.email ||
          undefined;
      } else if (
        typeof stripeObject.customer === 'object' &&
        stripeObject.customer !== null
      ) {
        customerId = stripeObject.customer.id || undefined;
        customerEmail =
          stripeObject.customer.email ||
          stripeObject.receipt_email ||
          stripeObject.billing_details?.email ||
          undefined;
      }
    }

    return { id: customerId, email: customerEmail };
  }

  /**
   * Sync initial 10 payment intents for a user
   */
  async syncInitialPaymentIntents(
    userId: number,
  ): Promise<{ synced: number; skipped: number }> {
    try {
      const stripe = await this.getStripeInstanceForUser(userId);

      const params: any = {
        limit: 10, // Only fetch first 10
        expand: [
          'data.customer',
          'data.latest_charge',
          'data.payment_method',
        ],
      };

      const paymentIntentsPage = await stripe.paymentIntents.list(params);

      console.log(
        `🔄 Processing ${paymentIntentsPage.data.length} initial payment intents for user ${userId}...`,
      );

      if (paymentIntentsPage.data.length === 0) {
        console.log(
          `⚠️  No payment intents found in Stripe for user ${userId}`,
        );
        return { synced: 0, skipped: 0 };
      }

      let synced = 0;
      let skipped = 0;
      let errorCount = 0;

      for (const pi of paymentIntentsPage.data) {
        try {
          const existing = await this.paymentIntentRepository.findOne({
            where: { stripeId: pi.id, userId },
          });

          if (existing) {
            skipped++;
            continue;
          }

          const customerInfo = this.extractCustomerInfo(pi);

          const paymentIntentData = {
            userId,
            stripeId: pi.id,
            stripeData: pi,
            amount: pi.amount,
            currency: pi.currency,
            status: pi.status,
            customerId: customerInfo.id,
            customerEmail: customerInfo.email,
            description: pi.description || null,
            paymentMethodType: pi.payment_method_types?.[0] || null,
            stripeCreatedAt: new Date(pi.created * 1000),
          };

          // Check if stripeId exists for another user
          const existingByStripeId = await this.paymentIntentRepository.findOne({
            where: { stripeId: pi.id },
          });

          if (existingByStripeId) {
            if (existingByStripeId.userId === userId) {
              await this.paymentIntentRepository.update(
                { id: existingByStripeId.id },
                { ...paymentIntentData, stripeData: paymentIntentData.stripeData as any },
              );
              synced++;
            } else {
              skipped++;
            }
          } else {
            const paymentIntent = this.paymentIntentRepository.create(paymentIntentData);
            await this.paymentIntentRepository.save(paymentIntent);
            synced++;
          }
        } catch (error: any) {
          errorCount++;
          console.error(
            `   ❌ Error syncing payment intent ${pi.id}:`,
            error.message,
          );
          if (error.code) {
            console.error(`   Error code: ${error.code}, Detail: ${error.detail}`);
          }
          if (error.constraint) {
            console.error(`   Constraint: ${error.constraint}`);
          }
          skipped++;
        }
      }

      if (errorCount > 0) {
        console.error(
          `   ⚠️  Encountered ${errorCount} errors while syncing initial payment intents`,
        );
      }

      console.log(
        `✅ Synced ${synced} initial payment intents for user ${userId} (${skipped} skipped)`,
      );
      return { synced, skipped };
    } catch (error: any) {
      console.error(
        `Error syncing initial payment intents for user ${userId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Sync payment intents in batches (100 records per batch)
   * Continues from where we left off by fetching older records
   */
  async syncPaymentIntentsBatch(
    userId: number,
    batchSize: number = 100,
  ): Promise<{ synced: number; skipped: number; hasMore: boolean }> {
    try {
      const stripe = await this.getStripeInstanceForUser(userId);

      // Get the oldest payment intent we have to continue backwards from
      const oldest = await this.paymentIntentRepository.findOne({
        where: { userId },
        order: { stripeCreatedAt: 'ASC' },
      });

      const params: any = {
        limit: batchSize,
        expand: [
          'data.customer',
          'data.latest_charge',
          'data.payment_method',
        ],
      };

      // Use timestamp instead of stripe_id to avoid "No such paymentintent" errors
      // If the oldest record was deleted from Stripe, using its ID will fail
      if (oldest?.stripeCreatedAt) {
        // Fetch records created before our oldest record's timestamp
        params.created = {
          lt: Math.floor(oldest.stripeCreatedAt.getTime() / 1000),
        };
      } else {
        // No records yet, fetch from the beginning (most recent)
        // This shouldn't happen if initial sync was done, but handle it anyway
        return { synced: 0, skipped: 0, hasMore: false };
      }

      const paymentIntentsPage = await stripe.paymentIntents.list(params);

      if (paymentIntentsPage.data.length === 0) {
        return { synced: 0, skipped: 0, hasMore: false };
      }

      let synced = 0;
      let skipped = 0;
      let errorCount = 0;

      for (const pi of paymentIntentsPage.data) {
        try {
          const existing = await this.paymentIntentRepository.findOne({
            where: { stripeId: pi.id, userId },
          });

          if (existing) {
            skipped++;
            continue;
          }

          const customerInfo = this.extractCustomerInfo(pi);

          const paymentIntentData = {
            userId,
            stripeId: pi.id,
            stripeData: pi,
            amount: pi.amount,
            currency: pi.currency,
            status: pi.status,
            customerId: customerInfo.id,
            customerEmail: customerInfo.email,
            description: pi.description || null,
            paymentMethodType: pi.payment_method_types?.[0] || null,
            stripeCreatedAt: new Date(pi.created * 1000),
          };

          // Check if stripeId exists for another user
          const existingByStripeId = await this.paymentIntentRepository.findOne({
            where: { stripeId: pi.id },
          });

          if (existingByStripeId) {
            if (existingByStripeId.userId === userId) {
              await this.paymentIntentRepository.update(
                { id: existingByStripeId.id },
                { ...paymentIntentData, stripeData: paymentIntentData.stripeData as any },
              );
              synced++;
            } else {
              skipped++;
            }
          } else {
            const paymentIntent = this.paymentIntentRepository.create(paymentIntentData);
            await this.paymentIntentRepository.save(paymentIntent);
            synced++;
          }
        } catch (error: any) {
          errorCount++;
          console.error(
            `   ❌ Error syncing payment intent ${pi.id}:`,
            error.message,
          );
          if (error.code) {
            console.error(`   Error code: ${error.code}, Detail: ${error.detail}`);
          }
          if (error.constraint) {
            console.error(`   Constraint: ${error.constraint}`);
          }
          skipped++;
        }
      }

      if (errorCount > 0) {
        console.error(
          `   ⚠️  Encountered ${errorCount} errors while syncing payment intents batch`,
        );
      }

      console.log(
        `✅ Synced ${synced} payment intents in batch for user ${userId} (${skipped} skipped, hasMore: ${paymentIntentsPage.has_more})`,
      );
      return {
        synced,
        skipped,
        hasMore: paymentIntentsPage.has_more,
      };
    } catch (error: any) {
      console.error(
        `Error syncing payment intents batch for user ${userId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Sync ALL payment intents for a user using pagination
   */
  async syncAllPaymentIntents(
    userId: number,
  ): Promise<{ synced: number; skipped: number }> {
    try {
      const stripe = await this.getStripeInstanceForUser(userId);

      let allPaymentIntents: any[] = [];
      let hasMore = true;
      let startingAfter: string | undefined = undefined;
      let pageCount = 0;
      const maxPages = 100; // Limit to prevent infinite loops

      console.log(
        `═══════════════════════════════════════════════════════════`,
      );
      console.log(
        `🔄 Starting to fetch and save payment intents for user ${userId}...`,
      );
      console.log(
        `   💡 Processing and saving as we fetch to avoid memory issues...`,
      );
      console.log(
        `═══════════════════════════════════════════════════════════`,
      );

      let synced = 0;
      let skipped = 0;
      let errorCount = 0;
      const processBatchSize = 50; // Process and save in batches of 50

      // Fetch and process incrementally to avoid memory issues
      while (hasMore && pageCount < maxPages) {
        const params: any = {
          limit: 100, // Stripe's maximum
          expand: [
            'data.customer',
            'data.latest_charge',
            'data.payment_method',
          ],
        };

        if (startingAfter) {
          params.starting_after = startingAfter;
        }

        const paymentIntentsPage = await stripe.paymentIntents.list(params);
        hasMore = paymentIntentsPage.has_more;

        if (paymentIntentsPage.data.length > 0) {
          startingAfter =
            paymentIntentsPage.data[paymentIntentsPage.data.length - 1].id;
        } else {
          hasMore = false;
        }

        pageCount++;
        console.log(
          `📥 Fetched page ${pageCount} of payment intents (${paymentIntentsPage.data.length} records in this page)`,
        );

        // Process and save this page immediately
        console.log(
          `   💾 Processing and saving page ${pageCount}...`,
        );

        // Process in smaller batches to avoid memory issues
        for (let i = 0; i < paymentIntentsPage.data.length; i += processBatchSize) {
          const batch = paymentIntentsPage.data.slice(i, i + processBatchSize);
          const batchNum = Math.floor(i / processBatchSize) + 1;
          const totalBatches = Math.ceil(paymentIntentsPage.data.length / processBatchSize);

          for (const pi of batch) {
          try {
            // First check if it exists for this user
            const existing = await this.paymentIntentRepository.findOne({
              where: { stripeId: pi.id, userId },
            });

            if (existing) {
              skipped++;
              if (skipped <= 3) {
                console.log(`   ⏭️  Skipping ${pi.id} - already exists for user ${userId}`);
              }
              continue;
            }

            const customerInfo = this.extractCustomerInfo(pi);

            // Use upsert to handle unique constraint violations gracefully
            const paymentIntentData = {
              userId,
              stripeId: pi.id,
              stripeData: pi,
              amount: pi.amount,
              currency: pi.currency,
              status: pi.status,
              customerId: customerInfo.id,
              customerEmail: customerInfo.email,
              description: pi.description || null,
              paymentMethodType: pi.payment_method_types?.[0] || null,
              stripeCreatedAt: new Date(pi.created * 1000),
            };

            // Try to find existing by stripeId globally (in case it exists for another user)
            const existingByStripeId = await this.paymentIntentRepository.findOne({
              where: { stripeId: pi.id },
            });

            if (existingByStripeId) {
              // This should not happen since we already checked above, but handle it
              if (existingByStripeId.userId === userId) {
                // Update existing record
                await this.paymentIntentRepository.update(
                  { id: existingByStripeId.id },
                  { ...paymentIntentData, stripeData: paymentIntentData.stripeData as any },
                );
                synced++;
                if (synced <= 3 || synced % 50 === 0) {
                  console.log(`   🔄 Updated payment intent ${pi.id} (${synced} total synced)`);
                }
              } else {
                // This stripeId exists for another user - skip it
                skipped++;
                if (skipped <= 3) {
                  console.warn(
                    `   ⚠️  Payment intent ${pi.id} exists for user ${existingByStripeId.userId}, skipping for user ${userId}`,
                  );
                }
              }
            } else {
              // Create new record - this is the main path for new records
              try {
                const paymentIntent = this.paymentIntentRepository.create(paymentIntentData);
                await this.paymentIntentRepository.save(paymentIntent);
                synced++;
                if (synced <= 10 || synced % 50 === 0) {
                  console.log(`   ✅ Saved NEW payment intent ${pi.id} (${synced} total saved)`);
                }
              } catch (saveError: any) {
                errorCount++;
                console.error(`   ❌ Failed to save ${pi.id}:`, saveError.message);
                if (saveError.code) {
                  console.error(`   Error code: ${saveError.code}, Detail: ${saveError.detail}`);
                }
                if (saveError.constraint) {
                  console.error(`   Constraint: ${saveError.constraint}`);
                }
                // Check if it was a unique constraint violation
                if (saveError.code === '23505' || saveError.constraint?.includes('stripe_id')) {
                  skipped++;
                  console.log(`   ⚠️  ${pi.id} already exists (unique constraint), skipping`);
                } else {
                  skipped++;
                }
              }
            }
          } catch (error: any) {
            errorCount++;
            console.error(
              `   ❌ Error syncing payment intent ${pi.id}:`,
              error.message,
            );
            if (error.code) {
              console.error(
                `   Error code: ${error.code}, Detail: ${error.detail}`,
              );
            }
            if (error.constraint) {
              console.error(`   Constraint: ${error.constraint}`);
            }
            if (error.stack) {
              console.error(`   Stack: ${error.stack.substring(0, 200)}...`);
            }
            skipped++;
          }
        }
        
          // Log progress after each batch
          if (batchNum % 5 === 0 || batchNum === totalBatches) {
            console.log(
              `   ✅ Processed batch ${batchNum}/${totalBatches} of page ${pageCount}: ${synced} synced, ${skipped} skipped so far`,
            );
          }
        }
        
        // Log progress after each page
        console.log(
          `   ✅ Page ${pageCount} completed: ${synced} total synced, ${skipped} total skipped`,
        );
        
        // Add a small delay to avoid rate limiting and give DB time to process
        if (pageCount % 10 === 0) {
          console.log(`   ⏸️  Pausing briefly after ${pageCount} pages...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (errorCount > 0) {
        console.error(
          `   ⚠️  Encountered ${errorCount} errors while syncing payment intents`,
        );
      }

      console.log(
        `═══════════════════════════════════════════════════════════`,
      );
      console.log(
        `✅ Completed syncing payment intents for user ${userId}`,
      );
      console.log(
        `   📊 Final Stats: ${synced} synced, ${skipped} skipped, ${errorCount} errors`,
      );
      console.log(
        `   📄 Total pages fetched: ${pageCount}`,
      );
      console.log(
        `═══════════════════════════════════════════════════════════`,
      );
      return { synced, skipped };
    } catch (error: any) {
      console.error(
        `Error syncing payment intents for user ${userId}:`,
        error.message,
      );
      throw error;
    }
  }


  /**
   * Sync initial 10 charges for a user
   */
  async syncInitialCharges(
    userId: number,
  ): Promise<{ synced: number; skipped: number }> {
    try {
      const stripe = await this.getStripeInstanceForUser(userId);

      const params: any = {
        limit: 10, // Only fetch first 10
        expand: ['data.customer', 'data.refunds', 'data.payment_intent'],
      };

      const chargesPage = await stripe.charges.list(params);

      console.log(
        `🔄 Processing ${chargesPage.data.length} initial charges for user ${userId}...`,
      );

      if (chargesPage.data.length === 0) {
        console.log(`⚠️  No charges found in Stripe for user ${userId}`);
        return { synced: 0, skipped: 0 };
      }

      let synced = 0;
      let skipped = 0;
      let errorCount = 0;

      for (const charge of chargesPage.data) {
        try {
          const existing = await this.chargeRepository.findOne({
            where: { stripeId: charge.id, userId },
          });

          if (existing) {
            skipped++;
            continue;
          }

          const customerInfo = this.extractCustomerInfo(charge);
          const paymentIntentId =
            typeof charge.payment_intent === 'string'
              ? charge.payment_intent
              : charge.payment_intent?.id || null;

          const chargeData = {
            userId,
            stripeId: charge.id,
            stripeData: charge,
            amount: charge.amount,
            currency: charge.currency,
            status: charge.status,
            customerId: customerInfo.id,
            customerEmail: customerInfo.email,
            description: charge.description || null,
            paymentIntentId,
            paymentMethodType: charge.payment_method_details?.type || null,
            amountRefunded: charge.amount_refunded || 0,
            refunded: charge.refunded || false,
            stripeCreatedAt: new Date(charge.created * 1000),
          };

          // Check if stripeId exists for another user
          const existingByStripeId = await this.chargeRepository.findOne({
            where: { stripeId: charge.id },
          });

          if (existingByStripeId) {
            if (existingByStripeId.userId === userId) {
              await this.chargeRepository.update(
                { id: existingByStripeId.id },
                { ...chargeData, stripeData: chargeData.stripeData as any },
              );
              synced++;
            } else {
              skipped++;
            }
          } else {
            const chargeEntity = this.chargeRepository.create(chargeData);
            await this.chargeRepository.save(chargeEntity);
            synced++;
          }
        } catch (error: any) {
          errorCount++;
          console.error(
            `   ❌ Error syncing charge ${charge.id}:`,
            error.message,
          );
          if (error.code) {
            console.error(`   Error code: ${error.code}, Detail: ${error.detail}`);
          }
          if (error.constraint) {
            console.error(`   Constraint: ${error.constraint}`);
          }
          skipped++;
        }
      }

      if (errorCount > 0) {
        console.error(
          `   ⚠️  Encountered ${errorCount} errors while syncing initial charges`,
        );
      }

      console.log(
        `✅ Synced ${synced} initial charges for user ${userId} (${skipped} skipped)`,
      );
      return { synced, skipped };
    } catch (error: any) {
      console.error(
        `Error syncing initial charges for user ${userId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Sync charges in batches (100 records per batch)
   * Continues from where we left off by fetching older records
   */
  async syncChargesBatch(
    userId: number,
    batchSize: number = 100,
  ): Promise<{ synced: number; skipped: number; hasMore: boolean }> {
    try {
      const stripe = await this.getStripeInstanceForUser(userId);

      // Get the oldest charge we have to continue backwards from
      const oldest = await this.chargeRepository.findOne({
        where: { userId },
        order: { stripeCreatedAt: 'ASC' },
      });

      const params: any = {
        limit: batchSize,
        expand: ['data.customer', 'data.refunds', 'data.payment_intent'],
      };

      // Use timestamp instead of stripe_id to avoid "No such charge" errors
      // If the oldest record was deleted from Stripe, using its ID will fail
      if (oldest?.stripeCreatedAt) {
        // Fetch records created before our oldest record's timestamp
        params.created = {
          lt: Math.floor(oldest.stripeCreatedAt.getTime() / 1000),
        };
      } else {
        // No records yet, fetch from the beginning (most recent)
        // This shouldn't happen if initial sync was done, but handle it anyway
        return { synced: 0, skipped: 0, hasMore: false };
      }

      const chargesPage = await stripe.charges.list(params);

      if (chargesPage.data.length === 0) {
        return { synced: 0, skipped: 0, hasMore: false };
      }

      let synced = 0;
      let skipped = 0;
      let errorCount = 0;

      for (const charge of chargesPage.data) {
        try {
          const existing = await this.chargeRepository.findOne({
            where: { stripeId: charge.id, userId },
          });

          if (existing) {
            skipped++;
            continue;
          }

          const customerInfo = this.extractCustomerInfo(charge);
          const paymentIntentId =
            typeof charge.payment_intent === 'string'
              ? charge.payment_intent
              : charge.payment_intent?.id || null;

          const chargeData = {
            userId,
            stripeId: charge.id,
            stripeData: charge,
            amount: charge.amount,
            currency: charge.currency,
            status: charge.status,
            customerId: customerInfo.id,
            customerEmail: customerInfo.email,
            description: charge.description || null,
            paymentIntentId,
            paymentMethodType: charge.payment_method_details?.type || null,
            amountRefunded: charge.amount_refunded || 0,
            refunded: charge.refunded || false,
            stripeCreatedAt: new Date(charge.created * 1000),
          };

          // Check if stripeId exists for another user
          const existingByStripeId = await this.chargeRepository.findOne({
            where: { stripeId: charge.id },
          });

          if (existingByStripeId) {
            if (existingByStripeId.userId === userId) {
              await this.chargeRepository.update(
                { id: existingByStripeId.id },
                { ...chargeData, stripeData: chargeData.stripeData as any },
              );
              synced++;
            } else {
              skipped++;
            }
          } else {
            const chargeEntity = this.chargeRepository.create(chargeData);
            await this.chargeRepository.save(chargeEntity);
            synced++;
          }
        } catch (error: any) {
          errorCount++;
          console.error(
            `   ❌ Error syncing charge ${charge.id}:`,
            error.message,
          );
          if (error.code) {
            console.error(`   Error code: ${error.code}, Detail: ${error.detail}`);
          }
          if (error.constraint) {
            console.error(`   Constraint: ${error.constraint}`);
          }
          skipped++;
        }
      }

      if (errorCount > 0) {
        console.error(
          `   ⚠️  Encountered ${errorCount} errors while syncing charges batch`,
        );
      }

      console.log(
        `✅ Synced ${synced} charges in batch for user ${userId} (${skipped} skipped, hasMore: ${chargesPage.has_more})`,
      );
      return {
        synced,
        skipped,
        hasMore: chargesPage.has_more,
      };
    } catch (error: any) {
      console.error(
        `Error syncing charges batch for user ${userId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Sync ALL charges for a user using pagination
   */
  async syncAllCharges(
    userId: number,
  ): Promise<{ synced: number; skipped: number }> {
    try {
      const stripe = await this.getStripeInstanceForUser(userId);

      let allCharges: any[] = [];
      let hasMore = true;
      let startingAfter: string | undefined = undefined;
      let pageCount = 0;
      const maxPages = 100; // Limit to prevent infinite loops

      console.log(
        `═══════════════════════════════════════════════════════════`,
      );
      console.log(
        `🔄 Starting to fetch and save charges for user ${userId}...`,
      );
      console.log(
        `   💡 Processing and saving as we fetch to avoid memory issues...`,
      );
      console.log(
        `═══════════════════════════════════════════════════════════`,
      );

      let synced = 0;
      let skipped = 0;
      let errorCount = 0;
      const processBatchSize = 50; // Process and save in batches of 50

      // Fetch and process incrementally to avoid memory issues
      while (hasMore && pageCount < maxPages) {
        const params: any = {
          limit: 100, // Stripe's maximum
          expand: ['data.customer', 'data.refunds', 'data.payment_intent'],
        };

        if (startingAfter) {
          params.starting_after = startingAfter;
        }

        const chargesPage = await stripe.charges.list(params);
        hasMore = chargesPage.has_more;

        if (chargesPage.data.length > 0) {
          startingAfter = chargesPage.data[chargesPage.data.length - 1].id;
        } else {
          hasMore = false;
        }

        pageCount++;
        console.log(
          `📥 Fetched page ${pageCount} of charges (${chargesPage.data.length} records in this page)`,
        );

        // Process and save this page immediately
        console.log(
          `   💾 Processing and saving page ${pageCount}...`,
        );

        // Process in smaller batches to avoid memory issues
        for (let i = 0; i < chargesPage.data.length; i += processBatchSize) {
          const batch = chargesPage.data.slice(i, i + processBatchSize);
          const batchNum = Math.floor(i / processBatchSize) + 1;
          const totalBatches = Math.ceil(chargesPage.data.length / processBatchSize);

          for (const charge of batch) {
          try {
            const existing = await this.chargeRepository.findOne({
              where: { stripeId: charge.id, userId },
            });

            if (existing) {
              skipped++;
              continue;
            }

            const customerInfo = this.extractCustomerInfo(charge);
            const paymentIntentId =
              typeof charge.payment_intent === 'string'
                ? charge.payment_intent
                : charge.payment_intent?.id || null;

            // Use upsert to handle unique constraint violations gracefully
            const chargeData = {
              userId,
              stripeId: charge.id,
              stripeData: charge,
              amount: charge.amount,
              currency: charge.currency,
              status: charge.status,
              customerId: customerInfo.id,
              customerEmail: customerInfo.email,
              description: charge.description || null,
              paymentIntentId,
              paymentMethodType: charge.payment_method_details?.type || null,
              amountRefunded: charge.amount_refunded || 0,
              refunded: charge.refunded || false,
              stripeCreatedAt: new Date(charge.created * 1000),
            };

            // Try to find existing by stripeId (in case it exists for another user)
            const existingByStripeId = await this.chargeRepository.findOne({
              where: { stripeId: charge.id },
            });

            if (existingByStripeId) {
              // Update if it exists but belongs to this user, skip if it belongs to another user
              if (existingByStripeId.userId === userId) {
                await this.chargeRepository.update(
                  { id: existingByStripeId.id },
                  { ...chargeData, stripeData: chargeData.stripeData as any },
                );
                synced++;
                if (synced % 50 === 0) {
                  console.log(`   💾 Saved ${synced} charges so far...`);
                }
              } else {
                // This stripeId exists for another user - skip it
                skipped++;
                console.warn(
                  `   ⚠️  Charge ${charge.id} already exists for user ${existingByStripeId.userId}, skipping for user ${userId}`,
                );
              }
            } else {
              // Create new record
              const chargeEntity = this.chargeRepository.create(chargeData);
              await this.chargeRepository.save(chargeEntity);
              synced++;
              if (synced % 50 === 0) {
                console.log(`   💾 Saved ${synced} charges so far...`);
              }
            }
          } catch (error: any) {
            errorCount++;
            console.error(
              `   ❌ Error syncing charge ${charge.id}:`,
              error.message,
            );
            if (error.code) {
              console.error(
                `   Error code: ${error.code}, Detail: ${error.detail}`,
              );
            }
            if (error.constraint) {
              console.error(`   Constraint: ${error.constraint}`);
            }
            if (error.stack) {
              console.error(`   Stack: ${error.stack.substring(0, 200)}...`);
            }
            skipped++;
          }
        }
        
          // Log progress after each batch
          if (batchNum % 5 === 0 || batchNum === totalBatches) {
            console.log(
              `   ✅ Processed batch ${batchNum}/${totalBatches} of page ${pageCount}: ${synced} synced, ${skipped} skipped so far`,
            );
          }
        }
        
        // Log progress after each page
        console.log(
          `   ✅ Page ${pageCount} completed: ${synced} total synced, ${skipped} total skipped`,
        );
        
        // Add a small delay to avoid rate limiting and give DB time to process
        if (pageCount % 10 === 0) {
          console.log(`   ⏸️  Pausing briefly after ${pageCount} pages...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (errorCount > 0) {
        console.error(
          `   ⚠️  Encountered ${errorCount} errors while syncing charges`,
        );
      }

      console.log(
        `═══════════════════════════════════════════════════════════`,
      );
      console.log(
        `✅ Completed syncing charges for user ${userId}`,
      );
      console.log(
        `   📊 Final Stats: ${synced} synced, ${skipped} skipped, ${errorCount} errors`,
      );
      console.log(
        `   📄 Total pages fetched: ${pageCount}`,
      );
      console.log(
        `═══════════════════════════════════════════════════════════`,
      );
      return { synced, skipped };
    } catch (error: any) {
      console.error(`Error syncing charges for user ${userId}:`, error.message);
      throw error;
    }
  }


  /**
   * Sync new payment intents (only new ones since last sync)
   */
  async syncNewPaymentIntents(
    userId: number,
  ): Promise<{ synced: number; skipped: number }> {
    try {
      const stripe = await this.getStripeInstanceForUser(userId);

      // Get the most recent payment intent we have
      const mostRecent = await this.paymentIntentRepository.findOne({
        where: { userId },
        order: { stripeCreatedAt: 'DESC' },
      });

      const params: any = {
        limit: 100,
        expand: ['data.customer', 'data.latest_charge', 'data.payment_method'],
      };

      // If we have a most recent, only fetch newer ones
      if (mostRecent?.stripeCreatedAt) {
        params.created = {
          gte: Math.floor(mostRecent.stripeCreatedAt.getTime() / 1000),
        };
      }

      const paymentIntents = await stripe.paymentIntents.list(params);

      let synced = 0;
      let skipped = 0;

      for (const pi of paymentIntents.data) {
        try {
          // Skip if we already have this
          if (pi.id === mostRecent?.stripeId) {
            continue;
          }

          const existing = await this.paymentIntentRepository.findOne({
            where: { stripeId: pi.id, userId },
          });

          if (existing) {
            skipped++;
            continue;
          }

          const customerInfo = this.extractCustomerInfo(pi);

          const paymentIntentData = {
            userId,
            stripeId: pi.id,
            stripeData: pi,
            amount: pi.amount,
            currency: pi.currency,
            status: pi.status,
            customerId: customerInfo.id,
            customerEmail: customerInfo.email,
            description: pi.description || null,
            paymentMethodType: pi.payment_method_types?.[0] || null,
            stripeCreatedAt: new Date(pi.created * 1000),
          };

          // Check if stripeId exists for another user
          const existingByStripeId = await this.paymentIntentRepository.findOne({
            where: { stripeId: pi.id },
          });

          if (existingByStripeId) {
            if (existingByStripeId.userId === userId) {
              await this.paymentIntentRepository.update(
                { id: existingByStripeId.id },
                { ...paymentIntentData, stripeData: paymentIntentData.stripeData as any },
              );
              synced++;
            } else {
              skipped++;
            }
          } else {
            const paymentIntent = this.paymentIntentRepository.create(paymentIntentData);
            await this.paymentIntentRepository.save(paymentIntent);
            synced++;
          }
        } catch (error: any) {
          console.error(
            `Error syncing payment intent ${pi.id}:`,
            error.message,
          );
          if (error.code) {
            console.error(`   Error code: ${error.code}, Detail: ${error.detail}`);
          }
          if (error.constraint) {
            console.error(`   Constraint: ${error.constraint}`);
          }
          skipped++;
        }
      }

      if (synced > 0) {
        console.log(
          `✅ Synced ${synced} new payment intents for user ${userId}`,
        );
      }
      return { synced, skipped };
    } catch (error: any) {
      console.error(
        `Error syncing new payment intents for user ${userId}:`,
        error.message,
      );
      return { synced: 0, skipped: 0 };
    }
  }

  /**
   * Get all connected account IDs for a user (with pagination support)
   */
  private async getConnectedAccountIds(userId: number): Promise<string[]> {
    try {
      const stripe = await this.getStripeInstanceForUser(userId);
      const accountIds: string[] = [];
      let hasMore = true;
      let startingAfter: string | undefined = undefined;
      let pageCount = 0;
      const maxPages = 100; // Limit to prevent infinite loops

      // Fetch all pages of connected accounts
      while (hasMore && pageCount < maxPages) {
        const params: any = {
          limit: 100, // Stripe's maximum
        };

        if (startingAfter) {
          params.starting_after = startingAfter;
        }

        const accountsPage = await stripe.accounts.list(params);
        hasMore = accountsPage.has_more;

        if (accountsPage.data.length > 0) {
          const pageAccountIds = accountsPage.data.map((account) => account.id);
          accountIds.push(...pageAccountIds);
          startingAfter = accountsPage.data[accountsPage.data.length - 1].id;
        } else {
          hasMore = false;
        }

        pageCount++;
        console.log(
          `   📥 Fetched page ${pageCount} of connected accounts (${accountsPage.data.length} accounts in this page, ${accountIds.length} total so far)`,
        );
      }

      console.log(
        `📋 Found ${accountIds.length} connected account(s) for user ${userId}${accountIds.length > 0 ? ` (across ${pageCount} page(s))` : ''}`,
      );
      return accountIds;
    } catch (error: any) {
      console.error(
        `Error fetching connected accounts for user ${userId}:`,
        error.message,
      );
      return [];
    }
  }

  /**
   * Sync initial 10 connected account payment intents for a user
   */
  async syncInitialConnectedAccountPaymentIntents(
    userId: number,
  ): Promise<{ synced: number; skipped: number }> {
    try {
      const stripe = await this.getStripeInstanceForUser(userId);
      const connectedAccountIds = await this.getConnectedAccountIds(userId);

      if (connectedAccountIds.length === 0) {
        console.log(
          `⚠️  No connected accounts found for user ${userId}, skipping connected account payment intents sync`,
        );
        return { synced: 0, skipped: 0 };
      }

      let totalSynced = 0;
      let totalSkipped = 0;

      // Sync payment intents for each connected account
      for (const accountId of connectedAccountIds) {
        try {
          const params: any = {
            limit: 10, // Only fetch first 10 per account
            expand: [
              'data.customer',
              'data.latest_charge',
              'data.payment_method',
            ],
          };

          const paymentIntentsPage = await stripe.paymentIntents.list(
            params,
            { stripeAccount: accountId },
          );

          console.log(
            `🔄 Processing ${paymentIntentsPage.data.length} initial payment intents for connected account ${accountId}...`,
          );

          if (paymentIntentsPage.data.length === 0) {
            continue;
          }

          let synced = 0;
          let skipped = 0;
          let errorCount = 0;

          for (const pi of paymentIntentsPage.data) {
            try {
              const existing = await this.paymentIntentRepository.findOne({
                where: { stripeId: pi.id, userId },
              });

              if (existing) {
                skipped++;
                continue;
              }

              const customerInfo = this.extractCustomerInfo(pi);
              const applicationId = accountId; // Use the connected account ID

              const paymentIntentData = {
                userId,
                stripeId: pi.id,
                stripeData: pi,
                amount: pi.amount,
                currency: pi.currency,
                status: pi.status,
                customerId: customerInfo.id,
                customerEmail: customerInfo.email,
                description: pi.description || null,
                paymentMethodType: pi.payment_method_types?.[0] || null,
                stripeCreatedAt: new Date(pi.created * 1000),
                application: applicationId,
              };

              // Check if stripeId exists for another user
              const existingByStripeId = await this.paymentIntentRepository.findOne({
                where: { stripeId: pi.id },
              });

              if (existingByStripeId) {
                if (existingByStripeId.userId === userId) {
                  await this.paymentIntentRepository.update(
                    { id: existingByStripeId.id },
                    { ...paymentIntentData, stripeData: paymentIntentData.stripeData as any },
                  );
                  synced++;
                } else {
                  skipped++;
                }
              } else {
                const paymentIntent = this.paymentIntentRepository.create(paymentIntentData);
                await this.paymentIntentRepository.save(paymentIntent);
                synced++;
              }
            } catch (error: any) {
              errorCount++;
              console.error(
                `   ❌ Error syncing connected account payment intent ${pi.id}:`,
                error.message,
              );
              if (error.code) {
                console.error(`   Error code: ${error.code}, Detail: ${error.detail}`);
              }
              if (error.constraint) {
                console.error(`   Constraint: ${error.constraint}`);
              }
              skipped++;
            }
          }

          if (errorCount > 0) {
            console.error(
              `   ⚠️  Encountered ${errorCount} errors while syncing payment intents for account ${accountId}`,
            );
          }

          console.log(
            `✅ Synced ${synced} payment intents for connected account ${accountId} (${skipped} skipped)`,
          );
          totalSynced += synced;
          totalSkipped += skipped;
        } catch (error: any) {
          console.error(
            `❌ Error syncing payment intents for connected account ${accountId}:`,
            error.message,
          );
        }
      }

      console.log(
        `✅ Synced ${totalSynced} total initial connected account payment intents for user ${userId} (${totalSkipped} skipped)`,
      );
      return { synced: totalSynced, skipped: totalSkipped };
    } catch (error: any) {
      console.error(
        `Error syncing initial connected account payment intents for user ${userId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Sync ALL connected account payment intents for a user using pagination
   */
  async syncAllConnectedAccountPaymentIntents(
    userId: number,
  ): Promise<{ synced: number; skipped: number }> {
    try {
      const stripe = await this.getStripeInstanceForUser(userId);
      const connectedAccountIds = await this.getConnectedAccountIds(userId);

      if (connectedAccountIds.length === 0) {
        console.log(
          `⚠️  No connected accounts found for user ${userId}, skipping connected account payment intents sync`,
        );
        return { synced: 0, skipped: 0 };
      }

      console.log(
        `═══════════════════════════════════════════════════════════`,
      );
      console.log(
        `🔄 Starting to fetch and save connected account payment intents for user ${userId}...`,
      );
      console.log(
        `   💡 Processing ${connectedAccountIds.length} connected account(s)...`,
      );
      console.log(
        `═══════════════════════════════════════════════════════════`,
      );

      let totalSynced = 0;
      let totalSkipped = 0;
      let totalErrorCount = 0;

      // Process each connected account
      for (const accountId of connectedAccountIds) {
        console.log(
          `\n📋 Processing connected account: ${accountId}`,
        );

        let hasMore = true;
        let startingAfter: string | undefined = undefined;
        let pageCount = 0;
        const maxPages = 100; // Limit to prevent infinite loops
        let synced = 0;
        let skipped = 0;
        let errorCount = 0;
        const processBatchSize = 50;

        // Fetch and process incrementally to avoid memory issues
        while (hasMore && pageCount < maxPages) {
          const params: any = {
            limit: 100, // Stripe's maximum
            expand: [
              'data.customer',
              'data.latest_charge',
              'data.payment_method',
            ],
          };

          if (startingAfter) {
            params.starting_after = startingAfter;
          }

          const paymentIntentsPage = await stripe.paymentIntents.list(
            params,
            { stripeAccount: accountId },
          );
          
          hasMore = paymentIntentsPage.has_more;

          if (paymentIntentsPage.data.length > 0) {
            startingAfter = paymentIntentsPage.data[paymentIntentsPage.data.length - 1].id;
          } else {
            hasMore = false;
          }

          pageCount++;
          console.log(
            `   📥 Fetched page ${pageCount} of payment intents for account ${accountId} (${paymentIntentsPage.data.length} records)`,
          );

          // Process in smaller batches
          for (let i = 0; i < paymentIntentsPage.data.length; i += processBatchSize) {
            const batch = paymentIntentsPage.data.slice(i, i + processBatchSize);
            const batchNum = Math.floor(i / processBatchSize) + 1;
            const totalBatches = Math.ceil(paymentIntentsPage.data.length / processBatchSize);

            for (const pi of batch) {
              try {
                const existing = await this.paymentIntentRepository.findOne({
                  where: { stripeId: pi.id, userId },
                });

                if (existing) {
                  skipped++;
                  continue;
                }

                const customerInfo = this.extractCustomerInfo(pi);
                const applicationId = accountId;

                const paymentIntentData = {
                  userId,
                  stripeId: pi.id,
                  stripeData: pi,
                  amount: pi.amount,
                  currency: pi.currency,
                  status: pi.status,
                  customerId: customerInfo.id,
                  customerEmail: customerInfo.email,
                  description: pi.description || null,
                  paymentMethodType: pi.payment_method_types?.[0] || null,
                  stripeCreatedAt: new Date(pi.created * 1000),
                  application: applicationId,
                };

                const existingByStripeId = await this.paymentIntentRepository.findOne({
                  where: { stripeId: pi.id },
                });

                if (existingByStripeId) {
                  if (existingByStripeId.userId === userId) {
                    await this.paymentIntentRepository.update(
                      { id: existingByStripeId.id },
                      { ...paymentIntentData, stripeData: paymentIntentData.stripeData as any },
                    );
                    synced++;
                  } else {
                    skipped++;
                  }
                } else {
                  try {
                    const paymentIntent = this.paymentIntentRepository.create(paymentIntentData);
                    await this.paymentIntentRepository.save(paymentIntent);
                    synced++;
                  } catch (saveError: any) {
                    errorCount++;
                    if (saveError.code === '23505' || saveError.constraint?.includes('stripe_id')) {
                      skipped++;
                    } else {
                      console.error(`   ❌ Failed to save ${pi.id}:`, saveError.message);
                      skipped++;
                    }
                  }
                }
              } catch (error: any) {
                errorCount++;
                console.error(
                  `   ❌ Error syncing payment intent ${pi.id}:`,
                  error.message,
                );
                skipped++;
              }
            }
          }

          if (pageCount % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        console.log(
          `   ✅ Account ${accountId}: ${synced} synced, ${skipped} skipped, ${errorCount} errors (${pageCount} pages)`,
        );
        totalSynced += synced;
        totalSkipped += skipped;
        totalErrorCount += errorCount;
      }

      console.log(
        `═══════════════════════════════════════════════════════════`,
      );
      console.log(
        `✅ Completed syncing connected account payment intents for user ${userId}`,
      );
      console.log(
        `   📊 Final Stats: ${totalSynced} synced, ${totalSkipped} skipped, ${totalErrorCount} errors`,
      );
      console.log(
        `═══════════════════════════════════════════════════════════`,
      );
      return { synced: totalSynced, skipped: totalSkipped };
    } catch (error: any) {
      console.error(
        `Error syncing connected account payment intents for user ${userId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Sync new connected account payment intents (only new ones since last sync)
   */
  async syncNewConnectedAccountPaymentIntents(
    userId: number,
  ): Promise<{ synced: number; skipped: number }> {
    try {
      const stripe = await this.getStripeInstanceForUser(userId);
      const connectedAccountIds = await this.getConnectedAccountIds(userId);

      if (connectedAccountIds.length === 0) {
        return { synced: 0, skipped: 0 };
      }

      let totalSynced = 0;
      let totalSkipped = 0;

      // Sync new payment intents for each connected account
      for (const accountId of connectedAccountIds) {
        try {
          // Get the most recent payment intent for this specific account
          const mostRecent = await this.paymentIntentRepository.findOne({
            where: { userId, application: accountId },
            order: { stripeCreatedAt: 'DESC' },
          });

          const params: any = {
            limit: 100,
            expand: ['data.customer', 'data.latest_charge', 'data.payment_method'],
          };

          // If we have a most recent, only fetch newer ones
          if (mostRecent?.stripeCreatedAt) {
            params.created = {
              gte: Math.floor(mostRecent.stripeCreatedAt.getTime() / 1000),
            };
          }

          const paymentIntents = await stripe.paymentIntents.list(
            params,
            { stripeAccount: accountId },
          );

          let synced = 0;
          let skipped = 0;

          for (const pi of paymentIntents.data) {
            try {
              // Skip if we already have this
              if (pi.id === mostRecent?.stripeId) {
                continue;
              }

              const existing = await this.paymentIntentRepository.findOne({
                where: { stripeId: pi.id, userId },
              });

              if (existing) {
                skipped++;
                continue;
              }

              const customerInfo = this.extractCustomerInfo(pi);
              const applicationId = accountId;

              const paymentIntentData = {
                userId,
                stripeId: pi.id,
                stripeData: pi,
                amount: pi.amount,
                currency: pi.currency,
                status: pi.status,
                customerId: customerInfo.id,
                customerEmail: customerInfo.email,
                description: pi.description || null,
                paymentMethodType: pi.payment_method_types?.[0] || null,
                stripeCreatedAt: new Date(pi.created * 1000),
                application: applicationId,
              };

              const existingByStripeId = await this.paymentIntentRepository.findOne({
                where: { stripeId: pi.id },
              });

              if (existingByStripeId) {
                if (existingByStripeId.userId === userId) {
                  await this.paymentIntentRepository.update(
                    { id: existingByStripeId.id },
                    { ...paymentIntentData, stripeData: paymentIntentData.stripeData as any },
                  );
                  synced++;
                } else {
                  skipped++;
                }
              } else {
                const paymentIntent = this.paymentIntentRepository.create(paymentIntentData);
                await this.paymentIntentRepository.save(paymentIntent);
                synced++;
              }
            } catch (error: any) {
              console.error(
                `Error syncing connected account payment intent ${pi.id}:`,
                error.message,
              );
              skipped++;
            }
          }

          totalSynced += synced;
          totalSkipped += skipped;
        } catch (error: any) {
          console.error(
            `Error syncing new payment intents for connected account ${accountId}:`,
            error.message,
          );
        }
      }

      if (totalSynced > 0) {
        console.log(
          `✅ Synced ${totalSynced} new connected account payment intents for user ${userId}`,
        );
      }
      return { synced: totalSynced, skipped: totalSkipped };
    } catch (error: any) {
      console.error(
        `Error syncing new connected account payment intents for user ${userId}:`,
        error.message,
      );
      return { synced: 0, skipped: 0 };
    }
  }

  /**
   * Sync initial 10 connected account charges for a user
   */
  async syncInitialConnectedAccountCharges(
    userId: number,
  ): Promise<{ synced: number; skipped: number }> {
    try {
      const stripe = await this.getStripeInstanceForUser(userId);
      const connectedAccountIds = await this.getConnectedAccountIds(userId);

      if (connectedAccountIds.length === 0) {
        console.log(
          `⚠️  No connected accounts found for user ${userId}, skipping connected account charges sync`,
        );
        return { synced: 0, skipped: 0 };
      }

      let totalSynced = 0;
      let totalSkipped = 0;

      // Sync charges for each connected account
      for (const accountId of connectedAccountIds) {
        try {
          const params: any = {
            limit: 10, // Only fetch first 10 per account
            expand: ['data.customer', 'data.refunds', 'data.payment_intent'],
          };

          const chargesPage = await stripe.charges.list(params, {
            stripeAccount: accountId,
          });

          console.log(
            `🔄 Processing ${chargesPage.data.length} initial charges for connected account ${accountId}...`,
          );

          if (chargesPage.data.length === 0) {
            continue;
          }

          let synced = 0;
          let skipped = 0;
          let errorCount = 0;

          for (const charge of chargesPage.data) {
            try {
              const existing = await this.chargeRepository.findOne({
                where: { stripeId: charge.id, userId },
              });

              if (existing) {
                skipped++;
                continue;
              }

              const customerInfo = this.extractCustomerInfo(charge);
              const paymentIntentId =
                typeof charge.payment_intent === 'string'
                  ? charge.payment_intent
                  : charge.payment_intent?.id || null;
              const applicationId = accountId;

              const chargeData = {
                userId,
                stripeId: charge.id,
                stripeData: charge,
                amount: charge.amount,
                currency: charge.currency,
                status: charge.status,
                customerId: customerInfo.id,
                customerEmail: customerInfo.email,
                description: charge.description || null,
                paymentIntentId,
                paymentMethodType: charge.payment_method_details?.type || null,
                amountRefunded: charge.amount_refunded || 0,
                refunded: charge.refunded || false,
                stripeCreatedAt: new Date(charge.created * 1000),
                application: applicationId,
              };

              const existingByStripeId = await this.chargeRepository.findOne({
                where: { stripeId: charge.id },
              });

              if (existingByStripeId) {
                if (existingByStripeId.userId === userId) {
                  await this.chargeRepository.update(
                    { id: existingByStripeId.id },
                    { ...chargeData, stripeData: chargeData.stripeData as any },
                  );
                  synced++;
                } else {
                  skipped++;
                }
              } else {
                const chargeEntity = this.chargeRepository.create(chargeData);
                await this.chargeRepository.save(chargeEntity);
                synced++;
              }
            } catch (error: any) {
              errorCount++;
              console.error(
                `   ❌ Error syncing connected account charge ${charge.id}:`,
                error.message,
              );
              skipped++;
            }
          }

          if (errorCount > 0) {
            console.error(
              `   ⚠️  Encountered ${errorCount} errors while syncing charges for account ${accountId}`,
            );
          }

          console.log(
            `✅ Synced ${synced} charges for connected account ${accountId} (${skipped} skipped)`,
          );
          totalSynced += synced;
          totalSkipped += skipped;
        } catch (error: any) {
          console.error(
            `❌ Error syncing charges for connected account ${accountId}:`,
            error.message,
          );
        }
      }

      console.log(
        `✅ Synced ${totalSynced} total initial connected account charges for user ${userId} (${totalSkipped} skipped)`,
      );
      return { synced: totalSynced, skipped: totalSkipped };
    } catch (error: any) {
      console.error(
        `Error syncing initial connected account charges for user ${userId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Sync ALL connected account charges for a user using pagination
   */
  async syncAllConnectedAccountCharges(
    userId: number,
  ): Promise<{ synced: number; skipped: number }> {
    try {
      const stripe = await this.getStripeInstanceForUser(userId);
      const connectedAccountIds = await this.getConnectedAccountIds(userId);

      if (connectedAccountIds.length === 0) {
        console.log(
          `⚠️  No connected accounts found for user ${userId}, skipping connected account charges sync`,
        );
        return { synced: 0, skipped: 0 };
      }

      console.log(
        `═══════════════════════════════════════════════════════════`,
      );
      console.log(
        `🔄 Starting to fetch and save connected account charges for user ${userId}...`,
      );
      console.log(
        `   💡 Processing ${connectedAccountIds.length} connected account(s)...`,
      );
      console.log(
        `═══════════════════════════════════════════════════════════`,
      );

      let totalSynced = 0;
      let totalSkipped = 0;
      let totalErrorCount = 0;

      // Process each connected account
      for (const accountId of connectedAccountIds) {
        console.log(
          `\n📋 Processing connected account: ${accountId}`,
        );

        let hasMore = true;
        let startingAfter: string | undefined = undefined;
        let pageCount = 0;
        const maxPages = 100;
        let synced = 0;
        let skipped = 0;
        let errorCount = 0;
        const processBatchSize = 50;

        // Fetch and process incrementally to avoid memory issues
        while (hasMore && pageCount < maxPages) {
          const params: any = {
            limit: 100,
            expand: ['data.customer', 'data.refunds', 'data.payment_intent'],
          };

          if (startingAfter) {
            params.starting_after = startingAfter;
          }

          const chargesPage = await stripe.charges.list(params, {
            stripeAccount: accountId,
          });
          
          hasMore = chargesPage.has_more;

          if (chargesPage.data.length > 0) {
            startingAfter = chargesPage.data[chargesPage.data.length - 1].id;
          } else {
            hasMore = false;
          }

          pageCount++;
          console.log(
            `   📥 Fetched page ${pageCount} of charges for account ${accountId} (${chargesPage.data.length} records)`,
          );

          // Process in smaller batches
          for (let i = 0; i < chargesPage.data.length; i += processBatchSize) {
            const batch = chargesPage.data.slice(i, i + processBatchSize);

            for (const charge of batch) {
              try {
                const existing = await this.chargeRepository.findOne({
                  where: { stripeId: charge.id, userId },
                });

                if (existing) {
                  skipped++;
                  continue;
                }

                const customerInfo = this.extractCustomerInfo(charge);
                const paymentIntentId =
                  typeof charge.payment_intent === 'string'
                    ? charge.payment_intent
                    : charge.payment_intent?.id || null;
                const applicationId = accountId;

                const chargeData = {
                  userId,
                  stripeId: charge.id,
                  stripeData: charge,
                  amount: charge.amount,
                  currency: charge.currency,
                  status: charge.status,
                  customerId: customerInfo.id,
                  customerEmail: customerInfo.email,
                  description: charge.description || null,
                  paymentIntentId,
                  paymentMethodType: charge.payment_method_details?.type || null,
                  amountRefunded: charge.amount_refunded || 0,
                  refunded: charge.refunded || false,
                  stripeCreatedAt: new Date(charge.created * 1000),
                  application: applicationId,
                };

                const existingByStripeId = await this.chargeRepository.findOne({
                  where: { stripeId: charge.id },
                });

                if (existingByStripeId) {
                  if (existingByStripeId.userId === userId) {
                    await this.chargeRepository.update(
                      { id: existingByStripeId.id },
                      { ...chargeData, stripeData: chargeData.stripeData as any },
                    );
                    synced++;
                  } else {
                    skipped++;
                  }
                } else {
                  try {
                    const chargeEntity = this.chargeRepository.create(chargeData);
                    await this.chargeRepository.save(chargeEntity);
                    synced++;
                  } catch (saveError: any) {
                    errorCount++;
                    if (saveError.code === '23505' || saveError.constraint?.includes('stripe_id')) {
                      skipped++;
                    } else {
                      console.error(`   ❌ Failed to save ${charge.id}:`, saveError.message);
                      skipped++;
                    }
                  }
                }
              } catch (error: any) {
                errorCount++;
                console.error(
                  `   ❌ Error syncing charge ${charge.id}:`,
                  error.message,
                );
                skipped++;
              }
            }
          }

          if (pageCount % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        console.log(
          `   ✅ Account ${accountId}: ${synced} synced, ${skipped} skipped, ${errorCount} errors (${pageCount} pages)`,
        );
        totalSynced += synced;
        totalSkipped += skipped;
        totalErrorCount += errorCount;
      }

      console.log(
        `═══════════════════════════════════════════════════════════`,
      );
      console.log(
        `✅ Completed syncing connected account charges for user ${userId}`,
      );
      console.log(
        `   📊 Final Stats: ${totalSynced} synced, ${totalSkipped} skipped, ${totalErrorCount} errors`,
      );
      console.log(
        `═══════════════════════════════════════════════════════════`,
      );
      return { synced: totalSynced, skipped: totalSkipped };
    } catch (error: any) {
      console.error(`Error syncing connected account charges for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Sync new connected account charges (only new ones since last sync)
   */
  async syncNewConnectedAccountCharges(
    userId: number,
  ): Promise<{ synced: number; skipped: number }> {
    try {
      const stripe = await this.getStripeInstanceForUser(userId);
      const connectedAccountIds = await this.getConnectedAccountIds(userId);

      if (connectedAccountIds.length === 0) {
        return { synced: 0, skipped: 0 };
      }

      let totalSynced = 0;
      let totalSkipped = 0;

      // Sync new charges for each connected account
      for (const accountId of connectedAccountIds) {
        try {
          // Get the most recent charge for this specific account
          const mostRecent = await this.chargeRepository.findOne({
            where: { userId, application: accountId },
            order: { stripeCreatedAt: 'DESC' },
          });

          const params: any = {
            limit: 100,
            expand: ['data.customer', 'data.refunds', 'data.payment_intent'],
          };

          // If we have a most recent, only fetch newer ones
          if (mostRecent?.stripeCreatedAt) {
            params.created = {
              gte: Math.floor(mostRecent.stripeCreatedAt.getTime() / 1000),
            };
          }

          const charges = await stripe.charges.list(params, {
            stripeAccount: accountId,
          });

          let synced = 0;
          let skipped = 0;

          for (const charge of charges.data) {
            try {
              // Skip if we already have this
              if (charge.id === mostRecent?.stripeId) {
                continue;
              }

              const existing = await this.chargeRepository.findOne({
                where: { stripeId: charge.id, userId },
              });

              if (existing) {
                skipped++;
                continue;
              }

              const customerInfo = this.extractCustomerInfo(charge);
              const paymentIntentId =
                typeof charge.payment_intent === 'string'
                  ? charge.payment_intent
                  : charge.payment_intent?.id || null;
              const applicationId = accountId;

              const chargeData = {
                userId,
                stripeId: charge.id,
                stripeData: charge,
                amount: charge.amount,
                currency: charge.currency,
                status: charge.status,
                customerId: customerInfo.id,
                customerEmail: customerInfo.email,
                description: charge.description || null,
                paymentIntentId,
                paymentMethodType: charge.payment_method_details?.type || null,
                amountRefunded: charge.amount_refunded || 0,
                refunded: charge.refunded || false,
                stripeCreatedAt: new Date(charge.created * 1000),
                application: applicationId,
              };

              const existingByStripeId = await this.chargeRepository.findOne({
                where: { stripeId: charge.id },
              });

              if (existingByStripeId) {
                if (existingByStripeId.userId === userId) {
                  await this.chargeRepository.update(
                    { id: existingByStripeId.id },
                    { ...chargeData, stripeData: chargeData.stripeData as any },
                  );
                  synced++;
                } else {
                  skipped++;
                }
              } else {
                const chargeEntity = this.chargeRepository.create(chargeData);
                await this.chargeRepository.save(chargeEntity);
                synced++;
              }
            } catch (error: any) {
              console.error(`Error syncing connected account charge ${charge.id}:`, error.message);
              skipped++;
            }
          }

          totalSynced += synced;
          totalSkipped += skipped;
        } catch (error: any) {
          console.error(
            `Error syncing new charges for connected account ${accountId}:`,
            error.message,
          );
        }
      }

      if (totalSynced > 0) {
        console.log(`✅ Synced ${totalSynced} new connected account charges for user ${userId}`);
      }
      return { synced: totalSynced, skipped: totalSkipped };
    } catch (error: any) {
      console.error(
        `Error syncing new connected account charges for user ${userId}:`,
        error.message,
      );
      return { synced: 0, skipped: 0 };
    }
  }

  /**
   * Sync new charges (only new ones since last sync)
   */
  async syncNewCharges(
    userId: number,
  ): Promise<{ synced: number; skipped: number }> {
    try {
      const stripe = await this.getStripeInstanceForUser(userId);

      // Get the most recent charge we have
      const mostRecent = await this.chargeRepository.findOne({
        where: { userId },
        order: { stripeCreatedAt: 'DESC' },
      });

      const params: any = {
        limit: 100,
        expand: ['data.customer', 'data.refunds', 'data.payment_intent'],
      };

      // If we have a most recent, only fetch newer ones
      if (mostRecent?.stripeCreatedAt) {
        params.created = {
          gte: Math.floor(mostRecent.stripeCreatedAt.getTime() / 1000),
        };
      }

      const charges = await stripe.charges.list(params);

      let synced = 0;
      let skipped = 0;

      for (const charge of charges.data) {
        try {
          // Skip if we already have this
          if (charge.id === mostRecent?.stripeId) {
            continue;
          }

          const existing = await this.chargeRepository.findOne({
            where: { stripeId: charge.id, userId },
          });

          if (existing) {
            skipped++;
            continue;
          }

          const customerInfo = this.extractCustomerInfo(charge);
          const paymentIntentId =
            typeof charge.payment_intent === 'string'
              ? charge.payment_intent
              : charge.payment_intent?.id || null;

          const chargeData = {
            userId,
            stripeId: charge.id,
            stripeData: charge,
            amount: charge.amount,
            currency: charge.currency,
            status: charge.status,
            customerId: customerInfo.id,
            customerEmail: customerInfo.email,
            description: charge.description || null,
            paymentIntentId,
            paymentMethodType: charge.payment_method_details?.type || null,
            amountRefunded: charge.amount_refunded || 0,
            refunded: charge.refunded || false,
            stripeCreatedAt: new Date(charge.created * 1000),
          };

          // Check if stripeId exists for another user
          const existingByStripeId = await this.chargeRepository.findOne({
            where: { stripeId: charge.id },
          });

          if (existingByStripeId) {
            if (existingByStripeId.userId === userId) {
              await this.chargeRepository.update(
                { id: existingByStripeId.id },
                { ...chargeData, stripeData: chargeData.stripeData as any },
              );
              synced++;
            } else {
              skipped++;
            }
          } else {
            const chargeEntity = this.chargeRepository.create(chargeData);
            await this.chargeRepository.save(chargeEntity);
            synced++;
          }
        } catch (error: any) {
          console.error(`Error syncing charge ${charge.id}:`, error.message);
          if (error.code) {
            console.error(`   Error code: ${error.code}, Detail: ${error.detail}`);
          }
          if (error.constraint) {
            console.error(`   Constraint: ${error.constraint}`);
          }
          skipped++;
        }
      }

      if (synced > 0) {
        console.log(`✅ Synced ${synced} new charges for user ${userId}`);
      }
      return { synced, skipped };
    } catch (error: any) {
      console.error(
        `Error syncing new charges for user ${userId}:`,
        error.message,
      );
      return { synced: 0, skipped: 0 };
    }
  }

  /**
   * Sync initial 10 payment intents and 10 charges for a user
   */
  async syncInitialRecords(
    userId: number,
  ): Promise<{
    paymentIntents: { synced: number; skipped: number };
    charges: { synced: number; skipped: number };
  }> {
    try {
      console.log(`🔄 Starting initial sync (first 10 records) for user ${userId}...`);
      
      const [piResult, chargeResult] = await Promise.all([
        this.syncInitialPaymentIntents(userId).catch((error: any) => {
          console.error(
            `   ❌ Error syncing initial payment intents for user ${userId}:`,
            error.message,
          );
          return { synced: 0, skipped: 0 };
        }),
        this.syncInitialCharges(userId).catch((error: any) => {
          console.error(
            `   ❌ Error syncing initial charges for user ${userId}:`,
            error.message,
          );
          return { synced: 0, skipped: 0 };
        }),
      ]);

      console.log(
        `✅ Initial sync completed for user ${userId}: ${piResult.synced} PIs, ${chargeResult.synced} Charges`,
      );

      return {
        paymentIntents: piResult,
        charges: chargeResult,
      };
    } catch (error: any) {
      console.error(`❌ Error in initial sync for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Sync next batch of records (100 payment intents and 100 charges)
   */
  async syncNextBatch(
    userId: number,
    batchSize: number = 100,
  ): Promise<{
    paymentIntents: { synced: number; skipped: number; hasMore: boolean };
    charges: { synced: number; skipped: number; hasMore: boolean };
  }> {
    try {
      console.log(
        `🔄 Syncing next batch (${batchSize} records) for user ${userId}...`,
      );

      const [piResult, chargeResult] = await Promise.all([
        this.syncPaymentIntentsBatch(userId, batchSize).catch((error: any) => {
          console.error(
            `   ❌ Error syncing payment intents batch for user ${userId}:`,
            error.message,
          );
          return { synced: 0, skipped: 0, hasMore: false };
        }),
        this.syncChargesBatch(userId, batchSize).catch((error: any) => {
          console.error(
            `   ❌ Error syncing charges batch for user ${userId}:`,
            error.message,
          );
          return { synced: 0, skipped: 0, hasMore: false };
        }),
      ]);

      console.log(
        `✅ Batch sync completed for user ${userId}: ${piResult.synced} PIs, ${chargeResult.synced} Charges`,
      );

      return {
        paymentIntents: piResult,
        charges: chargeResult,
      };
    } catch (error: any) {
      console.error(`❌ Error in batch sync for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Sync data for a specific user
   */
  async syncForUser(
    userId: number,
    initialSync: boolean = false,
  ): Promise<void> {
    try {
      if (initialSync) {
        // Initial sync: fetch ALL records using pagination
        console.log(`🔄 Starting initial full sync for user ${userId}...`);
        try {
          const piResult = await this.syncAllPaymentIntents(userId);
          console.log(
            `   Payment Intents: ${piResult.synced} synced, ${piResult.skipped} skipped`,
          );
        } catch (error: any) {
          console.error(
            `   ❌ Error syncing payment intents for user ${userId}:`,
            error.message,
          );
          console.error(error.stack);
          // Continue with charges even if payment intents fail
        }

        try {
          const chargeResult = await this.syncAllCharges(userId);
          console.log(
            `   Charges: ${chargeResult.synced} synced, ${chargeResult.skipped} skipped`,
          );
        } catch (error: any) {
          console.error(
            `   ❌ Error syncing charges for user ${userId}:`,
            error.message,
          );
          console.error(error.stack);
        }

        // Sync connected account payment intents and charges
        try {
          const connectedPiResult = await this.syncAllConnectedAccountPaymentIntents(userId);
          console.log(
            `   Connected Account Payment Intents: ${connectedPiResult.synced} synced, ${connectedPiResult.skipped} skipped`,
          );
        } catch (error: any) {
          console.error(
            `   ❌ Error syncing connected account payment intents for user ${userId}:`,
            error.message,
          );
          console.error(error.stack);
        }

        try {
          const connectedChargeResult = await this.syncAllConnectedAccountCharges(userId);
          console.log(
            `   Connected Account Charges: ${connectedChargeResult.synced} synced, ${connectedChargeResult.skipped} skipped`,
          );
        } catch (error: any) {
          console.error(
            `   ❌ Error syncing connected account charges for user ${userId}:`,
            error.message,
          );
          console.error(error.stack);
        }
        console.log(`✅ Initial sync completed for user ${userId}`);
      } else {
        // Background sync: fetch only new records
        await this.syncNewPaymentIntents(userId);
        await this.syncNewCharges(userId);
        await this.syncNewConnectedAccountPaymentIntents(userId);
        await this.syncNewConnectedAccountCharges(userId);
      }
    } catch (error: any) {
      console.error(`❌ Error syncing for user ${userId}:`, error.message);
      console.error(error.stack);
      throw error; // Re-throw to prevent silent failures
    }
  }

  /**
   * Sync all remaining records for a user (full sync)
   * This is useful if initial sync missed some records
   */
  async syncAllRecordsForUser(
    userId: number,
  ): Promise<{
    paymentIntents: { synced: number; skipped: number };
    charges: { synced: number; skipped: number };
  }> {
    console.log(`🔄 Starting full sync for all records for user ${userId}...`);
    const paymentIntentsResult = await this.syncAllPaymentIntents(userId);
    const chargesResult = await this.syncAllCharges(userId);
    console.log(`✅ Full sync completed for user ${userId}`);
    return {
      paymentIntents: paymentIntentsResult,
      charges: chargesResult,
    };
  }

  /**
   * Start background sync for all users with Stripe keys
   */
  async startBackgroundSync(): Promise<void> {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔄 Starting background Stripe data sync service...');
    console.log('═══════════════════════════════════════════════════════════');

    // Initial FULL sync for all users (fetch ALL records, not just 10)
    // This happens automatically when the server starts
    console.log(
      '📥 Performing INITIAL FULL SYNC for all users with Stripe keys...',
    );
    console.log(
      '   This will fetch ALL payment intents and charges from Stripe...',
    );
    await this.syncAllUsers(true);
    console.log('✅ Initial full sync completed!');
    console.log('═══════════════════════════════════════════════════════════');

    // Set up interval for background sync (only new records, faster)
    this.syncInterval = setInterval(async () => {
      console.log('🔄 Running incremental sync (new records only)...');
      await this.syncAllUsers(false);
    }, this.SYNC_INTERVAL_MS);

    // Set up interval for full sync (all records check, catches any missed ones)
    this.fullSyncInterval = setInterval(async () => {
      console.log('🔄 Running full sync check (all records)...');
      await this.syncAllUsers(true);
    }, this.FULL_SYNC_INTERVAL_MS);

    console.log(`✅ Background sync started`);
    console.log(
      `   - Incremental sync (new records): every ${this.SYNC_INTERVAL_MS / 1000}s`,
    );
    console.log(
      `   - Full sync (all records): every ${this.FULL_SYNC_INTERVAL_MS / 3600000} hour(s)`,
    );
  }

  /**
   * Sync data for all users who have Stripe keys
   */
  async syncAllUsers(initialSync: boolean = false): Promise<void> {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          'SELECT DISTINCT user_id FROM stripe_keys WHERE is_active = true',
        );

        const userIds = result.rows.map((row: any) => row.user_id);
        console.log(
          `📋 Found ${userIds.length} user(s) with active Stripe keys`,
        );

        for (const userId of userIds) {
          try {
            await this.syncForUser(userId, initialSync);
          } catch (error: any) {
            console.error(`❌ Failed to sync user ${userId}:`, error.message);
            // Continue with other users even if one fails
          }
        }
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('❌ Error syncing all users:', error.message);
      console.error(error.stack);
    }
  }

  /**
   * Stop background sync
   */
  stopBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.fullSyncInterval) {
      clearInterval(this.fullSyncInterval);
      this.fullSyncInterval = null;
    }
    console.log('🛑 Background sync stopped');
  }
}
