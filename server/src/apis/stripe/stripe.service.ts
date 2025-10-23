import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe | null;

  constructor() {
    const secret = (process.env.STRIPE_SECRET_KEY || process.env.REACT_APP_STRIPE_SECRET_KEY) as string | undefined;
    this.stripe = secret ? new Stripe(secret) : null;
  }

  private ensureStripe() {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY in server environment.',
      );
    }
  }

  async listTransactions(params: {
    limit?: number;
    starting_after?: string;
    ending_before?: string;
    customer?: string;
  }) {
    this.ensureStripe();
    const payments = await this.stripe!.paymentIntents.list({
      limit: params?.limit ?? 200,
      starting_after: params?.starting_after,
      ending_before: params?.ending_before,
      // Remove customer filtering to show all transactions from all accounts
      // customer: params?.customer,
      expand: ['data.payment_method'],
    });

    const transactions = payments.data.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      description: payment.description ?? undefined,
      customer: payment.customer
        ? {
            id: String(payment.customer),
            email: payment.receipt_email ?? undefined,
          }
        : undefined,
      // payment.payment_method can be string or object depending on expansions; keep undefined-safe
      payment_method: (payment as any).payment_method
        ? {
            type: (payment as any).payment_method.type,
            card: (payment as any).payment_method.card
              ? {
                  brand: (payment as any).payment_method.card.brand,
                  last4: (payment as any).payment_method.card.last4,
                }
              : undefined,
          }
        : undefined,
      created: payment.created,
      metadata: payment.metadata as Record<string, string>,
      fee: (payment as any).application_fee_amount,
      net: payment.amount - ((payment as any).application_fee_amount || 0),
      amount_received: payment.amount_received,
      amount_capturable: payment.amount_capturable,
      capture_method: payment.capture_method,
      confirmation_method: payment.confirmation_method,
      payment_method_types: payment.payment_method_types,
    }));

    return {
      data: transactions,
      has_more: payments.has_more,
      total_count: transactions.length,
    };
  }

  async getTransaction(id: string) {
    this.ensureStripe();
    const payment = await this.stripe!.paymentIntents.retrieve(id, {
      expand: ['payment_method'],
    });
    return {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      description: payment.description ?? undefined,
      customer: payment.customer
        ? {
            id: String(payment.customer),
            email: payment.receipt_email ?? undefined,
          }
        : undefined,
      payment_method: (payment as any).payment_method
        ? {
            type: (payment as any).payment_method.type,
            card: (payment as any).payment_method.card
              ? {
                  brand: (payment as any).payment_method.card.brand,
                  last4: (payment as any).payment_method.card.last4,
                }
              : undefined,
          }
        : undefined,
      created: payment.created,
      metadata: payment.metadata as Record<string, string>,
      fee: (payment as any).application_fee_amount,
      net: payment.amount - ((payment as any).application_fee_amount || 0),
      amount_received: payment.amount_received,
      amount_capturable: payment.amount_capturable,
      capture_method: payment.capture_method,
      confirmation_method: payment.confirmation_method,
      payment_method_types: payment.payment_method_types,
    };
  }

  async listTransactionsWithSummary(params: {
    limit?: number;
    starting_after?: string;
    ending_before?: string;
    customer?: string;
  }) {
    const result = await this.listTransactions(params);
    const summary = (result.data as any[]).reduce(
      (acc, payment) => {
        acc.total++;
        switch (payment.status) {
          case 'succeeded':
            acc.succeeded++;
            break;
          case 'pending':
            acc.pending++;
            break;
          case 'failed':
            acc.failed++;
            break;
          case 'canceled':
            acc.disputed++;
            break;
          default:
            acc.uncaptured++;
        }
        return acc;
      },
      {
        total: 0,
        succeeded: 0,
        pending: 0,
        failed: 0,
        refunded: 0,
        disputed: 0,
        uncaptured: 0,
      },
    );
    return { transactions: result, summary };
  }

  async getAllTransactionsWithSummary(params: {
    limit?: number;
  }) {
    this.ensureStripe();
    let allTransactions: any[] = [];
    let allSummary = {
      total: 0,
      succeeded: 0,
      pending: 0,
      failed: 0,
      refunded: 0,
      disputed: 0,
      uncaptured: 0,
    };

    console.log('Fetching transactions from platform account...');
    
    // First, get Payment Intents from the platform account
    const platformPayments = await this.stripe!.paymentIntents.list({
      limit: 100, // Stripe's maximum limit
      expand: ['data.payment_method', 'data.customer']
    });

    // Also get Charges from the platform account (these are what show in Stripe dashboard)
    console.log('Fetching charges from platform account...');
    const platformCharges = await this.stripe!.charges.list({
      limit: 100, // Stripe's maximum limit
      expand: ['data.customer'] // Only expand customer, not payment_method for charges
    });

    console.log(`Platform Payment Intents: ${platformPayments.data.length}`);
    console.log(`Platform Charges: ${platformCharges.data.length}`);

    // Fetch additional pages for Payment Intents
    let allPlatformPayments = [...platformPayments.data];
    let hasMore = platformPayments.has_more;
    let startingAfter = platformPayments.data[platformPayments.data.length - 1]?.id;

    while (hasMore && allPlatformPayments.length < 1000) {
      try {
        const nextPage = await this.stripe!.paymentIntents.list({
          limit: 100,
          starting_after: startingAfter,
          expand: ['data.payment_method', 'data.customer']
        });
        
        allPlatformPayments = [...allPlatformPayments, ...nextPage.data];
        hasMore = nextPage.has_more;
        startingAfter = nextPage.data[nextPage.data.length - 1]?.id;
        
        console.log(`Fetched additional ${nextPage.data.length} payment intents from platform account. Total: ${allPlatformPayments.length}`);
      } catch (error) {
        console.error('Error fetching additional platform payment intents:', error);
        break;
      }
    }

    // Fetch additional pages for Charges
    let allPlatformCharges = [...platformCharges.data];
    let chargesHasMore = platformCharges.has_more;
    let chargesStartingAfter = platformCharges.data[platformCharges.data.length - 1]?.id;

    while (chargesHasMore && allPlatformCharges.length < 1000) {
      try {
        const nextChargesPage = await this.stripe!.charges.list({
          limit: 100,
          starting_after: chargesStartingAfter,
          expand: ['data.customer'] // Only expand customer, not payment_method for charges
        });
        
        allPlatformCharges = [...allPlatformCharges, ...nextChargesPage.data];
        chargesHasMore = nextChargesPage.has_more;
        chargesStartingAfter = nextChargesPage.data[nextChargesPage.data.length - 1]?.id;
        
        console.log(`Fetched additional ${nextChargesPage.data.length} charges from platform account. Total: ${allPlatformCharges.length}`);
      } catch (error) {
        console.error('Error fetching additional platform charges:', error);
        break;
      }
    }

    console.log(`Platform account: ${allPlatformPayments.length} payment intents + ${allPlatformCharges.length} charges (including pagination)`);
    
    // Convert Payment Intents to our transaction format
    const platformPaymentTransactions = allPlatformPayments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      description: payment.description ?? undefined,
      customer: payment.customer
        ? {
            id: String(payment.customer),
            email: payment.receipt_email ?? undefined,
          }
        : undefined,
      payment_method: (payment as any).payment_method
        ? {
            type: (payment as any).payment_method.type,
            card: (payment as any).payment_method.card
              ? {
                  brand: (payment as any).payment_method.card.brand,
                  last4: (payment as any).payment_method.card.last4,
                }
              : undefined,
          }
        : undefined,
      created: payment.created,
      metadata: payment.metadata as Record<string, string>,
      fee: (payment as any).application_fee_amount,
      net: payment.amount - ((payment as any).application_fee_amount || 0),
      amount_received: payment.amount_received,
      amount_capturable: payment.amount_capturable,
      capture_method: payment.capture_method,
      confirmation_method: payment.confirmation_method,
      payment_method_types: payment.payment_method_types,
      stripe_account: 'platform',
    }));

    // Convert Charges to our transaction format
    const platformChargeTransactions = allPlatformCharges.map((charge) => ({
      id: charge.id,
      amount: charge.amount,
      currency: charge.currency,
      status: charge.status === 'succeeded' ? 'succeeded' : charge.status,
      description: charge.description ?? charge.metadata?.description ?? undefined,
      customer: charge.customer
        ? {
            id: String(charge.customer),
            email: charge.receipt_email ?? charge.billing_details?.email ?? undefined,
          }
        : undefined,
      payment_method: charge.payment_method_details
        ? {
            type: charge.payment_method_details.type,
            card: charge.payment_method_details.card
              ? {
                  brand: charge.payment_method_details.card.brand,
                  last4: charge.payment_method_details.card.last4,
                }
              : undefined,
          }
        : undefined,
      created: charge.created,
      metadata: charge.metadata as Record<string, string>,
      fee: charge.application_fee_amount,
      net: charge.amount - (charge.application_fee_amount || 0),
      amount_received: charge.amount, // Charges don't have amount_received, use amount
      amount_capturable: 0, // Charges are already captured
      capture_method: charge.captured ? 'automatic' : 'manual',
      confirmation_method: 'automatic',
      payment_method_types: [charge.payment_method_details?.type || 'card'],
      stripe_account: 'platform',
      charge_id: charge.id, // Add charge ID for reference
    }));

    // Combine payment intents and charges
    const platformTransactions = [...platformPaymentTransactions, ...platformChargeTransactions];
    allTransactions = [...platformTransactions];

    // Now get all Connect accounts and their transactions
    try {
      const accounts = await this.stripe!.accounts.list({ limit: 100 });
      console.log(`Found ${accounts.data.length} connected accounts`);

      for (const account of accounts.data) {
        try {
          console.log(`Fetching transactions for Connect account: ${account.id}`);
          
          // Fetch Payment Intents from Connect account
          const connectPayments = await this.stripe!.paymentIntents.list({
            limit: 100, // Stripe's maximum limit
            expand: ['data.payment_method', 'data.customer']
          }, {
            stripeAccount: account.id
          });

          // Also fetch Charges from Connect account
          const connectCharges = await this.stripe!.charges.list({
            limit: 100, // Stripe's maximum limit
            expand: ['data.customer'] // Only expand customer, not payment_method for charges
          }, {
            stripeAccount: account.id
          });

          // Fetch additional pages for Connect account
          let allConnectPayments = [...connectPayments.data];
          let connectHasMore = connectPayments.has_more;
          let connectStartingAfter = connectPayments.data[connectPayments.data.length - 1]?.id;

          while (connectHasMore && allConnectPayments.length < 1000) { // Safety limit
            try {
              const nextConnectPage = await this.stripe!.paymentIntents.list({
                limit: 100,
                starting_after: connectStartingAfter,
                expand: ['data.payment_method', 'data.customer']
              }, {
                stripeAccount: account.id
              });
              
              allConnectPayments = [...allConnectPayments, ...nextConnectPage.data];
              connectHasMore = nextConnectPage.has_more;
              connectStartingAfter = nextConnectPage.data[nextConnectPage.data.length - 1]?.id;
              
              console.log(`Fetched additional ${nextConnectPage.data.length} transactions from Connect account ${account.id}. Total: ${allConnectPayments.length}`);
            } catch (error) {
              console.error(`Error fetching additional Connect transactions for ${account.id}:`, error);
              break;
            }
          }

          // Fetch additional pages for Connect Charges
          let allConnectCharges = [...connectCharges.data];
          let connectChargesHasMore = connectCharges.has_more;
          let connectChargesStartingAfter = connectCharges.data[connectCharges.data.length - 1]?.id;

          while (connectChargesHasMore && allConnectCharges.length < 1000) {
            try {
              const nextConnectChargesPage = await this.stripe!.charges.list({
                limit: 100,
                starting_after: connectChargesStartingAfter,
                expand: ['data.customer'] // Only expand customer, not payment_method for charges
              }, {
                stripeAccount: account.id
              });
              
              allConnectCharges = [...allConnectCharges, ...nextConnectChargesPage.data];
              connectChargesHasMore = nextConnectChargesPage.has_more;
              connectChargesStartingAfter = nextConnectChargesPage.data[nextConnectChargesPage.data.length - 1]?.id;
              
              console.log(`Fetched additional ${nextConnectChargesPage.data.length} charges from Connect account ${account.id}. Total: ${allConnectCharges.length}`);
            } catch (error) {
              console.error(`Error fetching additional Connect charges for ${account.id}:`, error);
              break;
            }
          }

          console.log(`Connect account ${account.id}: ${allConnectPayments.length} payment intents + ${allConnectCharges.length} charges (including pagination)`);

          // Convert Payment Intents
          const connectPaymentTransactions = allConnectPayments.map((payment) => ({
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            description: payment.description ?? undefined,
            customer: payment.customer
              ? {
                  id: String(payment.customer),
                  email: payment.receipt_email ?? undefined,
                }
              : undefined,
            payment_method: (payment as any).payment_method
              ? {
                  type: (payment as any).payment_method.type,
                  card: (payment as any).payment_method.card
                    ? {
                        brand: (payment as any).payment_method.card.brand,
                        last4: (payment as any).payment_method.card.last4,
                      }
                    : undefined,
                }
              : undefined,
            created: payment.created,
            metadata: payment.metadata as Record<string, string>,
            fee: (payment as any).application_fee_amount,
            net: payment.amount - ((payment as any).application_fee_amount || 0),
            amount_received: payment.amount_received,
            amount_capturable: payment.amount_capturable,
            capture_method: payment.capture_method,
            confirmation_method: payment.confirmation_method,
            payment_method_types: payment.payment_method_types,
            stripe_account: account.id,
            account_email: account.email,
          }));

          // Convert Charges
          const connectChargeTransactions = allConnectCharges.map((charge) => ({
            id: charge.id,
            amount: charge.amount,
            currency: charge.currency,
            status: charge.status === 'succeeded' ? 'succeeded' : charge.status,
            description: charge.description ?? charge.metadata?.description ?? undefined,
            customer: charge.customer
              ? {
                  id: String(charge.customer),
                  email: charge.receipt_email ?? charge.billing_details?.email ?? undefined,
                }
              : undefined,
            payment_method: charge.payment_method_details
              ? {
                  type: charge.payment_method_details.type,
                  card: charge.payment_method_details.card
                    ? {
                        brand: charge.payment_method_details.card.brand,
                        last4: charge.payment_method_details.card.last4,
                      }
                    : undefined,
                }
              : undefined,
            created: charge.created,
            metadata: charge.metadata as Record<string, string>,
            fee: charge.application_fee_amount,
            net: charge.amount - (charge.application_fee_amount || 0),
            amount_received: charge.amount, // Charges don't have amount_received, use amount
            amount_capturable: 0, // Charges are already captured
            capture_method: charge.captured ? 'automatic' : 'manual',
            confirmation_method: 'automatic',
            payment_method_types: [charge.payment_method_details?.type || 'card'],
            stripe_account: account.id,
            account_email: account.email,
            charge_id: charge.id, // Add charge ID for reference
          }));

          // Combine payment intents and charges for this Connect account
          const connectTransactions = [...connectPaymentTransactions, ...connectChargeTransactions];
          allTransactions = [...allTransactions, ...connectTransactions];
        } catch (accountError) {
          console.error(`Error fetching transactions for account ${account.id}:`, accountError.message);
          // Continue with other accounts even if one fails
        }
      }
    } catch (connectError) {
      console.log('No Connect accounts found or error fetching Connect accounts:', connectError.message);
      // Continue with just platform transactions
    }

    // Remove duplicates - prioritize Payment Intents over Charges when both exist for the same transaction
    const deduplicatedTransactions = [];
    const seenAmounts = new Map(); // Track by amount + currency + timestamp to identify duplicates
    
    // Sort by creation date first
    allTransactions.sort((a, b) => b.created - a.created);
    
    for (const transaction of allTransactions) {
      // Create a unique key based on amount, currency, and creation time (within 1 minute tolerance)
      const key = `${transaction.amount}_${transaction.currency}_${Math.floor(transaction.created / 60)}`;
      
      if (!seenAmounts.has(key)) {
        // First time seeing this transaction
        deduplicatedTransactions.push(transaction);
        seenAmounts.set(key, transaction.id);
      } else {
        // We've seen a transaction with this amount/currency/time before
        const existingTransactionId = seenAmounts.get(key);
        const existingTransaction = deduplicatedTransactions.find(t => t.id === existingTransactionId);
        
        // Prefer Payment Intents over Charges when we have both
        if (transaction.id.startsWith('pi_') && existingTransaction?.id.startsWith('ch_')) {
          // Replace the charge with the payment intent
          const index = deduplicatedTransactions.findIndex(t => t.id === existingTransactionId);
          if (index !== -1) {
            deduplicatedTransactions[index] = transaction;
            seenAmounts.set(key, transaction.id);
          }
        }
        // If both are the same type or we prefer the existing one, skip this transaction
      }
    }

    console.log(`Deduplicated transactions: ${allTransactions.length} -> ${deduplicatedTransactions.length}`);

    // Calculate summary
    allSummary = deduplicatedTransactions.reduce((acc, payment) => {
      acc.total++;
      switch (payment.status) {
        case 'succeeded':
          acc.succeeded++;
          break;
        case 'pending':
          acc.pending++;
          break;
        case 'failed':
          acc.failed++;
          break;
        case 'canceled':
          acc.disputed++;
          break;
        case 'requires_payment_method':
        case 'requires_confirmation':
        case 'requires_action':
          acc.uncaptured++;
          break;
        default:
          acc.uncaptured++;
      }
      return acc;
    }, {
      total: 0,
      succeeded: 0,
      pending: 0,
      failed: 0,
      refunded: 0,
      disputed: 0,
      uncaptured: 0,
    });

    console.log(`Total transactions from all accounts: ${deduplicatedTransactions.length}`);
    console.log('Summary:', allSummary);
    console.log('Transaction IDs:', deduplicatedTransactions.map(t => t.id));

    return {
      transactions: {
        data: deduplicatedTransactions,
        has_more: false, // We're fetching all available
        total_count: deduplicatedTransactions.length,
      },
      summary: allSummary
    };
  }

  async listPayouts(params: {
    limit?: number;
    starting_after?: string;
    ending_before?: string;
  }) {
    this.ensureStripe();
    const payouts = await this.stripe!.payouts.list({
      limit: params?.limit ?? 200,
      starting_after: params?.starting_after,
      ending_before: params?.ending_before,
    });

    const formattedPayouts = payouts.data.map((payout) => ({
      id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      arrival_date: payout.arrival_date,
      created: payout.created,
      description: payout.description,
      destination: payout.destination,
      failure_code: payout.failure_code,
      failure_message: payout.failure_message,
      method: payout.method,
      source_type: payout.source_type,
      statement_descriptor: payout.statement_descriptor,
      type: payout.type,
      metadata: payout.metadata as Record<string, string>,
      stripe_account: 'platform',
    }));

    return {
      data: formattedPayouts,
      has_more: payouts.has_more,
      total_count: formattedPayouts.length,
    };
  }

  async getPayout(id: string) {
    this.ensureStripe();
    const payout = await this.stripe!.payouts.retrieve(id);
    return {
      id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      arrival_date: payout.arrival_date,
      created: payout.created,
      description: payout.description,
      destination: payout.destination,
      failure_code: payout.failure_code,
      failure_message: payout.failure_message,
      method: payout.method,
      source_type: payout.source_type,
      statement_descriptor: payout.statement_descriptor,
      type: payout.type,
      metadata: payout.metadata as Record<string, string>,
    };
  }

  async getAllPayoutsWithSummary(params: {
    limit?: number;
  }) {
    this.ensureStripe();
    let allPayouts: any[] = [];
    let allSummary = {
      total: 0,
      paid: 0,
      pending: 0,
      in_transit: 0,
      canceled: 0,
      failed: 0,
    };

    console.log('Fetching payouts from platform account...');
    
    // Get Payouts from the platform account
    const platformPayouts = await this.stripe!.payouts.list({
      limit: 100, // Stripe's maximum limit
    });

    console.log(`Platform Payouts: ${platformPayouts.data.length}`);

    // Fetch additional pages for Platform Payouts
    let allPlatformPayouts = [...platformPayouts.data];
    let hasMore = platformPayouts.has_more;
    let startingAfter = platformPayouts.data[platformPayouts.data.length - 1]?.id;

    while (hasMore && allPlatformPayouts.length < 1000) {
      try {
        const nextPage = await this.stripe!.payouts.list({
          limit: 100,
          starting_after: startingAfter,
        });
        
        allPlatformPayouts = [...allPlatformPayouts, ...nextPage.data];
        hasMore = nextPage.has_more;
        startingAfter = nextPage.data[nextPage.data.length - 1]?.id;
        
        console.log(`Fetched additional ${nextPage.data.length} payouts from platform account. Total: ${allPlatformPayouts.length}`);
      } catch (error) {
        console.error('Error fetching additional platform payouts:', error);
        break;
      }
    }

    // Convert Platform Payouts to our payout format
    const platformPayoutTransactions = allPlatformPayouts.map((payout) => ({
      id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      arrival_date: payout.arrival_date,
      created: payout.created,
      description: payout.description,
      destination: payout.destination,
      failure_code: payout.failure_code,
      failure_message: payout.failure_message,
      method: payout.method,
      source_type: payout.source_type,
      statement_descriptor: payout.statement_descriptor,
      type: payout.type,
      metadata: payout.metadata as Record<string, string>,
      stripe_account: 'platform',
    }));

    allPayouts = [...platformPayoutTransactions];

    // Now get all Connect accounts and their payouts
    try {
      const accounts = await this.stripe!.accounts.list({ limit: 100 });
      console.log(`Found ${accounts.data.length} connected accounts`);

      for (const account of accounts.data) {
        try {
          console.log(`Fetching payouts for Connect account: ${account.id}`);
          
          // Fetch Payouts from Connect account
          const connectPayouts = await this.stripe!.payouts.list({
            limit: 100, // Stripe's maximum limit
          }, {
            stripeAccount: account.id
          });

          // Fetch additional pages for Connect account
          let allConnectPayouts = [...connectPayouts.data];
          let connectHasMore = connectPayouts.has_more;
          let connectStartingAfter = connectPayouts.data[connectPayouts.data.length - 1]?.id;

          while (connectHasMore && allConnectPayouts.length < 1000) { // Safety limit
            try {
              const nextConnectPage = await this.stripe!.payouts.list({
                limit: 100,
                starting_after: connectStartingAfter,
              }, {
                stripeAccount: account.id
              });
              
              allConnectPayouts = [...allConnectPayouts, ...nextConnectPage.data];
              connectHasMore = nextConnectPage.has_more;
              connectStartingAfter = nextConnectPage.data[nextConnectPage.data.length - 1]?.id;
              
              console.log(`Fetched additional ${nextConnectPage.data.length} payouts from Connect account ${account.id}. Total: ${allConnectPayouts.length}`);
            } catch (error) {
              console.error(`Error fetching additional Connect payouts for ${account.id}:`, error);
              break;
            }
          }

          console.log(`Connect account ${account.id}: ${allConnectPayouts.length} payouts (including pagination)`);

          // Convert Connect Payouts
          const connectPayoutTransactions = allConnectPayouts.map((payout) => ({
            id: payout.id,
            amount: payout.amount,
            currency: payout.currency,
            status: payout.status,
            arrival_date: payout.arrival_date,
            created: payout.created,
            description: payout.description,
            destination: payout.destination,
            failure_code: payout.failure_code,
            failure_message: payout.failure_message,
            method: payout.method,
            source_type: payout.source_type,
            statement_descriptor: payout.statement_descriptor,
            type: payout.type,
            metadata: payout.metadata as Record<string, string>,
            stripe_account: account.id,
            account_email: account.email,
          }));

          allPayouts = [...allPayouts, ...connectPayoutTransactions];
        } catch (accountError) {
          console.error(`Error fetching payouts for account ${account.id}:`, accountError.message);
          // Continue with other accounts even if one fails
        }
      }
    } catch (connectError) {
      console.log('No Connect accounts found or error fetching Connect accounts:', connectError.message);
      // Continue with just platform payouts
    }

    // Sort by creation date
    allPayouts.sort((a, b) => b.created - a.created);

    console.log(`Total payouts from all accounts: ${allPayouts.length}`);

    // Calculate summary
    allSummary = allPayouts.reduce((acc, payout) => {
      acc.total++;
      switch (payout.status) {
        case 'paid':
          acc.paid++;
          break;
        case 'pending':
          acc.pending++;
          break;
        case 'in_transit':
          acc.in_transit++;
          break;
        case 'canceled':
          acc.canceled++;
          break;
        case 'failed':
          acc.failed++;
          break;
        default:
          acc.pending++;
      }
      return acc;
    }, {
      total: 0,
      paid: 0,
      pending: 0,
      in_transit: 0,
      canceled: 0,
      failed: 0,
    });

    console.log('Payout Summary:', allSummary);

    return {
      payouts: {
        data: allPayouts,
        has_more: false, // We're fetching all available
        total_count: allPayouts.length,
      },
      summary: allSummary
    };
  }

  async getConnectedAccounts() {
    this.ensureStripe();
    const accounts = await this.stripe!.accounts.list({ limit: 100 });
    console.log(`Found ${accounts.data.length} connected accounts`);
    
    return {
      accounts: accounts.data.map(acc => ({
        id: acc.id,
        email: acc.email,
        country: acc.country,
        type: acc.type,
        business_type: acc.business_type,
        charges_enabled: acc.charges_enabled,
        payouts_enabled: acc.payouts_enabled,
      })),
      total: accounts.data.length
    };
  }
}


