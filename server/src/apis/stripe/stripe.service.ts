import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';

// Simple in-memory cache for performance optimization
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class SimpleCache {
  private cache = new Map<string, CacheEntry>();

  set(key: string, data: any, ttlMs: number = 300000) {
    // 5 minutes default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear() {
    this.cache.clear();
  }

  delete(key: string) {
    this.cache.delete(key);
  }
}

@Injectable()
export class StripeService {
  private stripe: Stripe | null;
  private cache = new SimpleCache();

  constructor() {
    const secret = (process.env.STRIPE_SECRET_KEY ||
      process.env.REACT_APP_STRIPE_SECRET_KEY) as string | undefined;
    this.stripe = secret ? new Stripe(secret) : null;
    // Clear cache on service initialization to ensure fresh data
    this.cache.clear();
    console.log(
      'Stripe service initialized - all cache cleared (payouts cache disabled)',
    );
  }

  private ensureStripe() {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY in server environment.',
      );
    }
  }

  /**
   * Helper function to extract customer information from payment intent or charge
   * Handles both string ID and expanded customer object
   */
  private extractCustomerInfo(
    paymentOrCharge: any,
  ): { id: string; email?: string } | undefined {
    if (!paymentOrCharge.customer) {
      return undefined;
    }

    let customerId: string | undefined;
    let customerEmail: string | undefined;

    if (typeof paymentOrCharge.customer === 'string') {
      // Customer is just an ID
      customerId = paymentOrCharge.customer;
      // Use receipt_email or billing_details.email as fallback for email
      customerEmail =
        paymentOrCharge.receipt_email ||
        paymentOrCharge.billing_details?.email ||
        undefined;
    } else if (
      typeof paymentOrCharge.customer === 'object' &&
      paymentOrCharge.customer !== null
    ) {
      // Customer is expanded object
      customerId = paymentOrCharge.customer.id || undefined;
      customerEmail =
        paymentOrCharge.customer.email ||
        paymentOrCharge.receipt_email ||
        paymentOrCharge.billing_details?.email ||
        undefined;
    }

    if (!customerId) {
      return undefined;
    }

    return {
      id: customerId,
      email: customerEmail,
    };
  }

  // OPTIMIZED METHODS FOR FAST LOADING

  /**
   * Fast transactions loading with minimal API calls and caching
   */
  async getTransactionsFast(params: {
    limit?: number;
    page?: number;
    account?: string;
  }) {
    this.ensureStripe();

    const limit = Math.min(params?.limit || 50, 100); // Cap at 100 for performance
    const page = params?.page || 1;
    const account = params?.account || 'platform';

    const cacheKey = `transactions_${account}_${limit}_${page}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for transactions: ${account}_${limit}_${page}`);
      return cached;
    }

    try {
      // Minimal expansions for fast loading
      const expansions = ['data.customer'];

      let payments;
      if (account === 'platform') {
        payments = await this.stripe!.paymentIntents.list({
          limit,
          expand: expansions,
        });
      } else {
        payments = await this.stripe!.paymentIntents.list(
          {
            limit,
            expand: expansions,
          },
          {
            stripeAccount: account,
          },
        );
      }

      // Fast transformation with minimal data processing
      const transactions = payments.data.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        description: payment.description,
        customer: this.extractCustomerInfo(payment),
        created: payment.created,
        metadata: payment.metadata,
        stripe_account: account,
      }));

      const result = {
        data: transactions,
        has_more: payments.has_more,
        total_count: transactions.length,
        page,
        limit,
      };

      // Cache for 2 minutes
      this.cache.set(cacheKey, result, 120000);

      return result;
    } catch (error) {
      console.error('Error fetching fast transactions:', error);
      throw error;
    }
  }

  /**
   * Fast payouts loading with minimal API calls and caching
   */
  async getPayoutsFast(params: {
    limit?: number;
    page?: number;
    account?: string;
  }) {
    this.ensureStripe();

    const limit = Math.min(params?.limit || 50, 100); // Cap at 100 for performance
    const page = params?.page || 1;
    const account = params?.account || 'platform';

    const cacheKey = `payouts_${account}_${limit}_${page}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for payouts: ${account}_${limit}_${page}`);
      return cached;
    }

    try {
      let payouts;
      if (account === 'platform') {
        payouts = await this.stripe!.payouts.list({
          limit,
        });
      } else {
        payouts = await this.stripe!.payouts.list(
          {
            limit,
          },
          {
            stripeAccount: account,
          },
        );
      }

      // Fast transformation with minimal data processing
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
        stripe_account: account,
      }));

      const result = {
        data: formattedPayouts,
        has_more: payouts.has_more,
        total_count: formattedPayouts.length,
        page,
        limit,
      };

      // Cache for 5 minutes (payouts change less frequently)
      this.cache.set(cacheKey, result, 300000);

      return result;
    } catch (error) {
      console.error('Error fetching fast payouts:', error);
      throw error;
    }
  }

  /**
   * Get summary data efficiently with caching
   */
  async getSummaryFast(account?: string) {
    this.ensureStripe();

    const cacheKey = `summary_${account || 'all'}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for summary: ${account || 'all'}`);
      return cached;
    }

    try {
      // Get recent transactions for summary (last 30 days)
      const thirtyDaysAgo = Math.floor(
        (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000,
      );

      let payments;
      if (account === 'platform' || !account) {
        payments = await this.stripe!.paymentIntents.list({
          limit: 100,
          created: { gte: thirtyDaysAgo },
        });
      } else {
        payments = await this.stripe!.paymentIntents.list(
          {
            limit: 100,
            created: { gte: thirtyDaysAgo },
          },
          {
            stripeAccount: account,
          },
        );
      }

      // Calculate summary efficiently
      const summary = payments.data.reduce(
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

      // Cache for 5 minutes
      this.cache.set(cacheKey, summary, 300000);

      return summary;
    } catch (error) {
      console.error('Error fetching summary:', error);
      throw error;
    }
  }

  /**
   * Get all accounts efficiently with caching
   */
  async getAccountsFast() {
    this.ensureStripe();

    const cacheKey = 'accounts_list';
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log('Cache hit for accounts');
      return cached;
    }

    try {
      const accounts = await this.stripe!.accounts.list({ limit: 100 });

      const result = {
        accounts: accounts.data.map((acc) => ({
          id: acc.id,
          email: acc.email,
          country: acc.country,
          type: acc.type,
          business_type: acc.business_type,
          charges_enabled: acc.charges_enabled,
          payouts_enabled: acc.payouts_enabled,
        })),
        total: accounts.data.length,
      };

      // Cache for 10 minutes (accounts don't change often)
      this.cache.set(cacheKey, result, 600000);

      return result;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }
  }

  /**
   * Get transactions from platform account only - optimized version
   * Uses ONLY: /v1/payment_intents endpoint
   */
  async getAllTransactionsFast(params: {
    limit?: number;
    page?: number;
    status?: string;
    statusFilter?: string[]; // Array of raw payment intent statuses
    days?: number;
    amount?: number;
    amountOperator?: string; // 'eq', 'gt', 'lt', 'gte', 'lte'
    currency?: string;
    paymentMethod?: string; // 'card', 'bank_account', etc.
  }) {
    this.ensureStripe();

    const limit = Math.min(params?.limit || 50, 100);
    const page = params?.page || 1;

    // Disable caching for transactions to ensure fresh data
    // const cacheKey = `all_transactions_${limit}_${page}`;
    // const cached = this.cache.get(cacheKey);
    // if (cached) {
    //   console.log(`Cache hit for all transactions: ${limit}_${page}`);
    //   return cached;
    // }

    try {
      // Get platform account transactions from both Payment Intents and Charges
      // API Endpoints: /v1/payment_intents and /v1/charges
      // Stripe dashboard shows Charges primarily, so we fetch both and prioritize Charges
      console.log(
        `Fetching fresh transactions from /v1/payment_intents and /v1/charges (with pagination)...`,
      );

      // Fetch ALL Payment Intents with pagination
      let allPlatformPayments: any[] = [];
      let hasMorePayments = true;
      let startingAfterPayment: string | undefined = undefined;

      while (hasMorePayments && allPlatformPayments.length < 1000) {
        const paymentParams: any = {
          limit: 100, // Stripe's maximum
          expand: [
            'data.customer',
            'data.latest_charge',
            'data.latest_charge.outcome',
            'data.latest_charge.refunds',
            'data.latest_charge.balance_transaction',
            'data.latest_charge.transfer_data',
            'data.payment_method',
          ],
        };

        if (startingAfterPayment) {
          paymentParams.starting_after = startingAfterPayment;
        }

        const platformPaymentsPage =
          await this.stripe!.paymentIntents.list(paymentParams);
        allPlatformPayments = [
          ...allPlatformPayments,
          ...platformPaymentsPage.data,
        ];
        hasMorePayments = platformPaymentsPage.has_more;

        if (platformPaymentsPage.data.length > 0) {
          startingAfterPayment =
            platformPaymentsPage.data[platformPaymentsPage.data.length - 1].id;
        } else {
          hasMorePayments = false;
        }
      }

      // Fetch ALL Charges with pagination (these are what show in Stripe dashboard)
      let allPlatformCharges: any[] = [];
      let hasMoreCharges = true;
      let startingAfterCharge: string | undefined = undefined;

      while (hasMoreCharges && allPlatformCharges.length < 1000) {
        const chargeParams: any = {
          limit: 100, // Stripe's maximum
          expand: ['data.customer', 'data.refunds', 'data.balance_transaction'],
        };

        if (startingAfterCharge) {
          chargeParams.starting_after = startingAfterCharge;
        }

        const platformChargesPage =
          await this.stripe!.charges.list(chargeParams);
        allPlatformCharges = [
          ...allPlatformCharges,
          ...platformChargesPage.data,
        ];
        hasMoreCharges = platformChargesPage.has_more;

        if (platformChargesPage.data.length > 0) {
          startingAfterCharge =
            platformChargesPage.data[platformChargesPage.data.length - 1].id;
        } else {
          hasMoreCharges = false;
        }
      }

      console.log(
        `Stripe returned ${allPlatformPayments.length} payment intents (across all pages) and ${allPlatformCharges.length} charges (across all pages)`,
      );

      // Log all charge IDs for debugging - specifically look for $100 charge
      console.log(
        'All Charge IDs:',
        allPlatformCharges.map((c) => ({
          id: c.id,
          amount: c.amount / 100,
          currency: c.currency,
          status: c.status,
          created: new Date(c.created * 1000).toISOString(),
          payment_method: c.payment_method_details?.type,
          card_last4: c.payment_method_details?.card?.last4,
        })),
      );
      console.log(
        'All Payment Intent IDs:',
        allPlatformPayments.map((p) => ({
          id: p.id,
          amount: p.amount / 100,
          created: new Date(p.created * 1000).toISOString(),
        })),
      );

      // Check if we have a $100 charge - check both exact match and close matches
      const hundredDollarCharges = allPlatformCharges.filter((c) => {
        const amountInDollars = c.amount / 100;
        return (
          amountInDollars === 100 ||
          (amountInDollars >= 99.99 && amountInDollars <= 100.01)
        );
      });
      console.log(
        `Found ${hundredDollarCharges.length} charge(s) with $100 amount:`,
        hundredDollarCharges.map((c) => ({
          id: c.id,
          amount: c.amount / 100,
          currency: c.currency,
          status: c.status,
          created: new Date(c.created * 1000).toISOString(),
          payment_method: c.payment_method_details?.type,
          card_last4: c.payment_method_details?.card?.last4,
        })),
      );

      // Also check all charges to see what we have
      console.log(
        'All charges summary:',
        allPlatformCharges.map((c) => ({
          id: c.id,
          amount: c.amount / 100,
          status: c.status,
        })),
      );

      // Track charge IDs from Payment Intents and create a map for deduplication
      const paymentIntentToChargeMap = new Map<string, string>(); // paymentIntentId -> chargeId

      // Convert Payment Intents to transactions
      const platformPaymentTransactions = allPlatformPayments.map((payment) => {
        // Access latest_charge through the payment object (may be expanded)
        const paymentAny = payment as any;
        const latestCharge = paymentAny.latest_charge;

        // Track the charge ID for deduplication
        if (latestCharge) {
          let chargeId: string | null = null;
          if (
            typeof latestCharge === 'object' &&
            latestCharge !== null &&
            latestCharge.id
          ) {
            chargeId = latestCharge.id;
          } else if (typeof latestCharge === 'string') {
            chargeId = latestCharge;
          }

          if (chargeId) {
            paymentIntentToChargeMap.set(payment.id, chargeId);
          }
        }

        // Extract outcome for decline reason
        const outcome = latestCharge?.outcome;
        const refunds = latestCharge?.refunds?.data || [];
        const balanceTransaction = latestCharge?.balance_transaction;
        const transferData = latestCharge?.transfer_data;

        // Check if payment has refunds by checking the latest charge
        let isRefunded = false;
        let refundedAmount = 0;

        if (latestCharge) {
          // If latest_charge is expanded, it's an object; otherwise it's a string ID
          if (typeof latestCharge === 'object' && latestCharge !== null) {
            // Charge is expanded, check for refunds
            if (latestCharge.refunded) {
              isRefunded = true;
              refundedAmount += latestCharge.amount_refunded || 0;
            } else if (refunds && refunds.length > 0) {
              isRefunded = true;
              refundedAmount += refunds.reduce(
                (sum: number, refund: any) => sum + (refund.amount || 0),
                0,
              );
            }
          } else if (typeof latestCharge === 'string') {
            // Charge is not expanded, fetch it to check for refunds
            // For now, we'll skip this to avoid extra API calls
            // In production, you might want to batch fetch charges
          }
        }

        // Extract payment method information
        const paymentMethod = payment.payment_method;
        let paymentMethodType = null;
        let paymentMethodCard = null;

        if (paymentMethod) {
          if (typeof paymentMethod === 'object' && paymentMethod !== null) {
            paymentMethodType = paymentMethod.type;
            if (paymentMethod.type === 'card' && paymentMethod.card) {
              paymentMethodCard = {
                brand: paymentMethod.card.brand,
                last4: paymentMethod.card.last4,
              };
            }
          }
        }

        return {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          description: payment.description || undefined,
          customer: this.extractCustomerInfo(payment),
          created: payment.created,
          metadata: payment.metadata || {},
          stripe_account: 'platform',
          is_refunded: isRefunded,
          refunded_amount: refundedAmount,
          amount_received: payment.amount_received || undefined,
          payment_method: paymentMethodType
            ? {
                type: paymentMethodType,
                card: paymentMethodCard,
              }
            : undefined,
          // Decline reason and failure details
          decline_reason:
            outcome?.reason ||
            outcome?.failure_code ||
            outcome?.decline_reason ||
            undefined,
          failure_message: outcome?.failure_message || undefined,
          risk_level: outcome?.risk_level || undefined,
          // Settlement and transfer information
          settlement_merchant:
            transferData?.destination ||
            balanceTransaction?.destination ||
            undefined,
          // Terminal information (if available in metadata)
          terminal_location:
            payment.metadata?.terminal_location ||
            payment.metadata?.location_id ||
            undefined,
        };
      });

      // Convert Charges to transactions
      const platformChargeTransactions = allPlatformCharges.map((charge) => {
        const refunds = charge.refunds?.data || [];
        const balanceTransaction = charge.balance_transaction;
        const isRefunded = charge.refunded || refunds.length > 0;
        const refundedAmount =
          charge.amount_refunded ||
          refunds.reduce(
            (sum: number, refund: any) => sum + (refund.amount || 0),
            0,
          );

        // Handle balance transaction - it can be a string ID or an expanded object
        let settlementMerchant: string | undefined = undefined;
        let balanceTransactionDetails: any = undefined;
        if (balanceTransaction) {
          if (
            typeof balanceTransaction === 'object' &&
            balanceTransaction !== null
          ) {
            settlementMerchant =
              (balanceTransaction as any).destination || undefined;
            balanceTransactionDetails = {
              id: (balanceTransaction as any).id,
              amount: (balanceTransaction as any).amount,
              available_on: (balanceTransaction as any).available_on,
              created: (balanceTransaction as any).created,
              currency: (balanceTransaction as any).currency,
              description: (balanceTransaction as any).description,
              exchange_rate: (balanceTransaction as any).exchange_rate,
              fee: (balanceTransaction as any).fee,
              fee_details: (balanceTransaction as any).fee_details,
              net: (balanceTransaction as any).net,
              reporting_category: (balanceTransaction as any)
                .reporting_category,
              status: (balanceTransaction as any).status,
              type: (balanceTransaction as any).type,
            };
          }
        }

        // Extract payment method details with more card information
        let paymentMethodDetails: any = undefined;
        if (charge.payment_method_details) {
          paymentMethodDetails = {
            type: charge.payment_method_details.type,
            card: charge.payment_method_details.card
              ? {
                  brand: charge.payment_method_details.card.brand,
                  last4: charge.payment_method_details.card.last4,
                  exp_month: charge.payment_method_details.card.exp_month,
                  exp_year: charge.payment_method_details.card.exp_year,
                  funding: charge.payment_method_details.card.funding,
                  country: charge.payment_method_details.card.country,
                  fingerprint: charge.payment_method_details.card.fingerprint,
                  network: charge.payment_method_details.card.network,
                  network_transaction_id:
                    charge.payment_method_details.card.network_transaction_id,
                  authorization_code:
                    charge.payment_method_details.card.authorization_code,
                  checks: charge.payment_method_details.card.checks,
                }
              : undefined,
          };
        }

        return {
          id: charge.id,
          object: charge.object || 'charge',
          amount: charge.amount,
          amount_captured: charge.amount_captured,
          amount_refunded: charge.amount_refunded,
          currency: charge.currency,
          status:
            charge.status === 'succeeded'
              ? 'succeeded'
              : charge.status === 'failed'
                ? 'failed'
                : 'pending',
          description:
            charge.description || charge.metadata?.description || undefined,
          customer: this.extractCustomerInfo(charge),
          created: charge.created,
          metadata: charge.metadata || {},
          stripe_account: 'platform',
          is_refunded: isRefunded,
          refunded_amount: refundedAmount,
          amount_received: charge.amount, // Charges are already captured
          payment_method: paymentMethodDetails,
          // Decline reason and failure details
          decline_reason:
            charge.outcome?.reason || charge.failure_code || undefined,
          failure_message: charge.failure_message || undefined,
          failure_code: charge.failure_code || undefined,
          failure_balance_transaction:
            charge.failure_balance_transaction || undefined,
          risk_level: charge.outcome?.risk_level || undefined,
          outcome: charge.outcome
            ? {
                network_status: charge.outcome.network_status,
                reason: charge.outcome.reason,
                risk_level: charge.outcome.risk_level,
                risk_score: charge.outcome.risk_score,
                seller_message: charge.outcome.seller_message,
                type: charge.outcome.type,
                advice_code: charge.outcome.advice_code,
                network_advice_code: charge.outcome.network_advice_code,
                network_decline_code: charge.outcome.network_decline_code,
              }
            : undefined,
          // Settlement and transfer information
          settlement_merchant: settlementMerchant,
          balance_transaction: balanceTransactionDetails,
          balance_transaction_id:
            typeof balanceTransaction === 'string'
              ? balanceTransaction
              : balanceTransaction?.id,
          // Application and fee information
          application: charge.application || null,
          application_fee: charge.application_fee || null,
          application_fee_amount: charge.application_fee_amount || null,
          // Billing details
          billing_details: charge.billing_details
            ? {
                address: charge.billing_details.address
                  ? {
                      city: charge.billing_details.address.city,
                      country: charge.billing_details.address.country,
                      line1: charge.billing_details.address.line1,
                      line2: charge.billing_details.address.line2,
                      postal_code: charge.billing_details.address.postal_code,
                      state: charge.billing_details.address.state,
                    }
                  : undefined,
                email: charge.billing_details.email,
                name: charge.billing_details.name,
                phone: charge.billing_details.phone,
                tax_id: charge.billing_details.tax_id,
              }
            : undefined,
          // Statement descriptors
          calculated_statement_descriptor:
            charge.calculated_statement_descriptor || undefined,
          statement_descriptor: charge.statement_descriptor || undefined,
          statement_descriptor_suffix:
            charge.statement_descriptor_suffix || undefined,
          // Capture and payment status
          captured: charge.captured,
          paid: charge.paid,
          // Dispute information
          dispute: (charge as any).dispute || null,
          disputed: charge.disputed || false,
          // Payment intent reference
          payment_intent:
            typeof charge.payment_intent === 'string'
              ? charge.payment_intent
              : charge.payment_intent?.id || undefined,
          // Receipt information
          receipt_email: charge.receipt_email || undefined,
          receipt_number: charge.receipt_number || undefined,
          receipt_url: charge.receipt_url || undefined,
          // Refund information
          refunds: refunds.map((refund: any) => ({
            id: refund.id,
            amount: refund.amount,
            created: refund.created,
            currency: refund.currency,
            reason: refund.reason,
            status: refund.status,
          })),
          // Review information
          review: charge.review || null,
          // Shipping information
          shipping: charge.shipping || null,
          // Source information
          source: charge.source || null,
          source_transfer: charge.source_transfer || null,
          // Transfer information
          transfer_data: charge.transfer_data || null,
          transfer_group: charge.transfer_group || null,
          // On behalf of
          on_behalf_of: charge.on_behalf_of || null,
          // Order reference
          order: charge.order || null,
          // Livemode
          livemode: charge.livemode || false,
          // Terminal information (if available in metadata)
          terminal_location:
            charge.metadata?.terminal_location ||
            charge.metadata?.location_id ||
            undefined,
          // Charge reference
          charge_id: charge.id,
        };
      });

      // Remove duplicates - prioritize Charges over Payment Intents (Stripe dashboard shows Charges)
      // A Payment Intent creates a Charge, so we show the Charge and skip the Payment Intent if it has a charge
      const uniqueTransactions: any[] = [];
      const seenTransactionIds = new Set<string>();

      // First, add ALL Charges (these are what Stripe dashboard shows)
      // Charges are the actual payment transactions
      // All charges should have IDs starting with 'ch_', but we'll add all charge transactions regardless
      for (const transaction of platformChargeTransactions) {
        // All charges converted from Stripe charges should have 'ch_' prefix
        // But we'll add all transactions from platformChargeTransactions to be safe
        uniqueTransactions.push(transaction);
        seenTransactionIds.add(transaction.id);
        console.log(
          `Added Charge: ${transaction.id}, Amount: ${transaction.amount / 100}, Status: ${transaction.status}, Created: ${new Date(transaction.created * 1000).toISOString()}`,
        );
      }

      console.log(
        `Total Charges added: ${uniqueTransactions.length} out of ${platformChargeTransactions.length} charge transactions`,
      );

      // Then, add Payment Intents that don't have a charge yet (uncaptured payment intents)
      // These are payment intents that haven't been converted to charges yet
      for (const transaction of platformPaymentTransactions) {
        if (transaction.id.startsWith('pi_')) {
          // Check if this payment intent has a charge that we've already added
          const chargeId = paymentIntentToChargeMap.get(transaction.id);
          const hasCharge = chargeId ? seenTransactionIds.has(chargeId) : false;

          // Only add payment intents that don't have a charge (uncaptured)
          if (!hasCharge) {
            uniqueTransactions.push(transaction);
          }
        }
      }

      console.log(
        `After deduplication: ${uniqueTransactions.length} unique transactions (from ${platformPaymentTransactions.length} payment intents + ${platformChargeTransactions.length} charges)`,
      );

      // Log all unique transaction IDs and amounts for debugging
      console.log(
        'Unique Transactions:',
        uniqueTransactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          status: t.status,
          created: new Date(t.created * 1000).toISOString(),
        })),
      );

      // Sort by creation date (newest first)
      uniqueTransactions.sort((a, b) => b.created - a.created);

      // Apply date filter if provided (is in the last X days)
      let dateFilteredTransactions = uniqueTransactions;
      if (params?.days && params.days > 0) {
        const now = Math.floor(Date.now() / 1000);
        const daysAgo = now - params.days * 24 * 60 * 60;
        dateFilteredTransactions = uniqueTransactions.filter((transaction) => {
          return transaction.created >= daysAgo;
        });
        console.log(
          `Filtered by date (last ${params.days} days): ${dateFilteredTransactions.length} transactions (from ${uniqueTransactions.length} total)`,
        );
      }

      // Apply status filter if provided
      let filteredTransactions = dateFilteredTransactions;

      // If statusFilter array is provided, filter by raw payment intent statuses
      if (params?.statusFilter && params.statusFilter.length > 0) {
        filteredTransactions = dateFilteredTransactions.filter(
          (transaction: any) => {
            const status = transaction.status as string;

            // Handle special case: 'refunded' status filter should check is_refunded flag
            // If 'refunded' is in the filter and transaction is refunded, include it
            if (params.statusFilter!.includes('refunded')) {
              if (transaction.is_refunded) return true;
            }

            // For status matching: check if the transaction status is in the filter array
            // Note: If 'succeeded' is in filter, we still want succeeded transactions even if they're refunded
            // (user can explicitly filter by both 'succeeded' and 'refunded' if they want only refunded succeeded)
            if (params.statusFilter!.includes(status)) {
              // Special handling: if filtering by 'succeeded' but not 'refunded', exclude refunded succeeded transactions
              // This matches Stripe dashboard behavior where 'succeeded' excludes refunded
              if (
                status === 'succeeded' &&
                !params.statusFilter!.includes('refunded') &&
                transaction.is_refunded
              ) {
                return false;
              }
              return true;
            }

            return false;
          },
        );
        console.log(
          `Filtered by statusFilter [${params.statusFilter.join(', ')}]: ${filteredTransactions.length} transactions (from ${dateFilteredTransactions.length} total)`,
        );
      } else if (params?.status && params.status !== 'all') {
        // Legacy status filter using summary categories
        filteredTransactions = dateFilteredTransactions.filter(
          (transaction: any) => {
            const status = transaction.status as string;
            switch (params.status) {
              case 'succeeded':
                return status === 'succeeded' && !transaction.is_refunded;
              case 'refunded':
                return transaction.is_refunded === true;
              case 'failed':
                return status === 'failed' || status === 'canceled';
              case 'disputed':
                return status === 'canceled' && !transaction.is_refunded;
              case 'uncaptured':
                return (
                  status !== 'succeeded' &&
                  status !== 'processing' &&
                  status !== 'requires_payment_method' &&
                  status !== 'requires_confirmation' &&
                  status !== 'requires_action' &&
                  status !== 'failed' &&
                  status !== 'canceled' &&
                  !transaction.is_refunded
                );
              default:
                return true;
            }
          },
        );
        console.log(
          `Filtered by status '${params.status}': ${filteredTransactions.length} transactions (from ${dateFilteredTransactions.length} total)`,
        );
      }

      // Apply amount filter if provided
      if (params?.amount !== undefined && params.amount !== null) {
        const amountInCents = Math.round(params.amount * 100); // Convert to cents
        const operator = params.amountOperator || 'eq';

        filteredTransactions = filteredTransactions.filter(
          (transaction: any) => {
            switch (operator) {
              case 'eq':
                return transaction.amount === amountInCents;
              case 'gt':
                return transaction.amount > amountInCents;
              case 'lt':
                return transaction.amount < amountInCents;
              case 'gte':
                return transaction.amount >= amountInCents;
              case 'lte':
                return transaction.amount <= amountInCents;
              default:
                return transaction.amount === amountInCents;
            }
          },
        );
        console.log(
          `Filtered by amount (${operator} ${params.amount}): ${filteredTransactions.length} transactions`,
        );
      }

      // Apply currency filter if provided
      if (params?.currency && params.currency !== 'all') {
        filteredTransactions = filteredTransactions.filter(
          (transaction: any) =>
            transaction.currency.toLowerCase() ===
            params.currency.toLowerCase(),
        );
        console.log(
          `Filtered by currency '${params.currency}': ${filteredTransactions.length} transactions`,
        );
      }

      // Apply payment method filter if provided
      // Note: Stripe's PaymentIntent.list() and Charge.list() APIs don't support filtering by payment method type
      // So we fetch all transactions and filter them here on the backend
      if (params?.paymentMethod && params.paymentMethod !== 'all') {
        filteredTransactions = filteredTransactions.filter(
          (transaction: any) => {
            const transactionPaymentMethodType =
              transaction.payment_method?.type;
            // Case-insensitive matching
            if (!transactionPaymentMethodType) {
              return false;
            }
            return (
              transactionPaymentMethodType.toLowerCase() ===
              params.paymentMethod.toLowerCase()
            );
          },
        );
        console.log(
          `Filtered by payment method '${params.paymentMethod}': ${filteredTransactions.length} transactions`,
        );
      }

      // Apply pagination on the backend side
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedTransactions = filteredTransactions.slice(
        startIndex,
        endIndex,
      );

      console.log(
        `Page ${page}: Showing transactions ${startIndex + 1} to ${Math.min(endIndex, filteredTransactions.length)} of ${filteredTransactions.length} total (filtered from ${dateFilteredTransactions.length} date-filtered, ${uniqueTransactions.length} unique)`,
      );

      // Calculate summary from date-filtered transactions (not just current page)
      // Match Stripe dashboard: All, Succeeded, Refunded, Disputed, Failed, Uncaptured
      const summary = dateFilteredTransactions.reduce(
        (acc, transaction: any) => {
          acc.total++;
          const status = transaction.status as string;

          // Check if refunded first (refunded transactions can have succeeded status)
          if (transaction.is_refunded) {
            acc.refunded++;
          } else if (status === 'succeeded') {
            acc.succeeded++;
          } else if (status === 'failed' || status === 'canceled') {
            // Only count as failed if not refunded
            if (status === 'failed') {
              acc.failed++;
            } else if (status === 'canceled') {
              acc.disputed++;
            }
          } else if (
            status === 'processing' ||
            status === 'requires_payment_method' ||
            status === 'requires_confirmation' ||
            status === 'requires_action'
          ) {
            // These are considered uncaptured
            acc.uncaptured++;
          } else {
            acc.uncaptured++;
          }
          return acc;
        },
        {
          total: 0,
          succeeded: 0,
          refunded: 0,
          disputed: 0,
          failed: 0,
          uncaptured: 0,
        },
      );

      const result = {
        transactions: {
          data: paginatedTransactions,
          has_more: endIndex < filteredTransactions.length,
          total_count: filteredTransactions.length,
        },
        summary,
      };

      // Cache disabled for transactions to ensure accurate data
      // this.cache.set(cacheKey, result, 120000);

      console.log(
        `Total transactions: ${uniqueTransactions.length} unique, ${dateFilteredTransactions.length} after date filter, ${filteredTransactions.length} after status filter, returning ${paginatedTransactions.length} for page ${page}`,
      );
      return result;
    } catch (error) {
      console.error('Error fetching all transactions:', error);
      throw error;
    }
  }

  /**
   * Get payouts from platform account only - optimized version
   * Uses ONLY: /v1/payouts endpoint
   */
  async getAllPayoutsFast(params: {
    limit?: number;
    page?: number;
    status?: string;
  }) {
    this.ensureStripe();

    const limit = Math.min(params?.limit || 50, 100);
    const page = params?.page || 1;

    // Disable caching for payouts to ensure fresh data
    // Cache was causing issues with stale data showing duplicate payouts
    // const cacheKey = `all_payouts_${limit}_${page}`;
    // const cached = this.cache.get(cacheKey);
    // if (cached) {
    //   console.log(`Cache hit for all payouts: ${limit}_${page}`);
    //   return cached;
    // }

    console.log(`Fetching fresh payouts data (cache disabled for accuracy)...`);

    try {
      // Get platform account payouts only
      // API Endpoint: /v1/payouts
      // Note: Stripe uses cursor-based pagination, not page numbers
      // For simplicity, we'll fetch all payouts and let the frontend handle pagination
      // OR we can implement proper cursor-based pagination
      console.log(
        `Fetching platform payouts from /v1/payouts (limit: ${limit})...`,
      );

      const platformPayouts = await this.stripe!.payouts.list({
        limit: 100, // Fetch more to get accurate count, but we'll limit the response
      });

      // Log what Stripe actually returned
      console.log(
        `Stripe returned ${platformPayouts.data.length} payouts, has_more: ${platformPayouts.has_more}`,
      );

      const platformPayoutTransactions = platformPayouts.data.map((payout) => ({
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
        metadata: payout.metadata,
        stripe_account: 'platform',
      }));

      // Remove duplicates by ID (in case of any issues)
      const uniquePayouts = platformPayoutTransactions.filter(
        (payout, index, self) =>
          index === self.findIndex((p) => p.id === payout.id),
      );

      console.log(
        `After deduplication: ${uniquePayouts.length} unique payouts (was ${platformPayoutTransactions.length})`,
      );

      // Sort by creation date (newest first)
      uniquePayouts.sort((a, b) => b.created - a.created);

      // Apply status filter if provided
      let filteredPayouts = uniquePayouts;
      if (params?.status && params.status !== 'all') {
        filteredPayouts = uniquePayouts.filter((payout) => {
          switch (params.status) {
            case 'paid':
              return payout.status === 'paid';
            case 'pending':
              return payout.status === 'pending';
            case 'in_transit':
              return payout.status === 'in_transit';
            case 'failed':
              return payout.status === 'failed';
            case 'canceled':
              return payout.status === 'canceled';
            default:
              return true;
          }
        });
        console.log(
          `Filtered by status '${params.status}': ${filteredPayouts.length} payouts (from ${uniquePayouts.length} total)`,
        );
      }

      // Apply pagination on the backend side
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedPayouts = filteredPayouts.slice(startIndex, endIndex);

      console.log(
        `Page ${page}: Showing payouts ${startIndex + 1} to ${Math.min(endIndex, filteredPayouts.length)} of ${filteredPayouts.length} total (filtered from ${uniquePayouts.length} unique)`,
      );

      // Calculate summary from ALL payouts (not just current page)
      const summary = uniquePayouts.reduce(
        (acc, payout) => {
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
        },
        {
          total: 0,
          paid: 0,
          pending: 0,
          in_transit: 0,
          canceled: 0,
          failed: 0,
        },
      );

      const result = {
        payouts: {
          data: paginatedPayouts,
          has_more: endIndex < filteredPayouts.length,
          total_count: filteredPayouts.length,
        },
        summary,
      };

      // Cache disabled for payouts to ensure accurate data
      // this.cache.set(cacheKey, result, 300000);

      console.log(
        `Total payouts: ${uniquePayouts.length} unique, ${filteredPayouts.length} after filter, returning ${paginatedPayouts.length} for page ${page}`,
      );
      return result;
    } catch (error) {
      console.error('Error fetching all payouts:', error);
      throw error;
    }
  }

  /**
   * Clear cache for specific keys or all
   */
  clearCache(pattern?: string) {
    if (pattern) {
      // Clear specific cache entries matching pattern
      for (const key of this.cache['cache'].keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  async listTransactions(params: {
    limit?: number;
    starting_after?: string;
    ending_before?: string;
    customer?: string;
  }) {
    this.ensureStripe();

    // Use caching for better performance
    const cacheKey = `list_transactions_${params?.limit || 200}_${params?.starting_after || 'none'}_${params?.ending_before || 'none'}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Reduced expansions for better performance
    const payments = await this.stripe!.paymentIntents.list({
      limit: Math.min(params?.limit ?? 100, 100), // Cap at 100 for performance
      starting_after: params?.starting_after,
      ending_before: params?.ending_before,
      // Remove customer filtering to show all transactions from all accounts
      // customer: params?.customer,
      expand: [
        'data.customer', // Only essential expansion
      ],
    });

    // Simplified transaction mapping for better performance
    const transactions = payments.data.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      description: payment.description,
      customer: this.extractCustomerInfo(payment),
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

    const result = {
      data: transactions,
      has_more: payments.has_more,
      total_count: transactions.length,
    };

    // Cache for 2 minutes
    this.cache.set(cacheKey, result, 120000);

    return result;
  }

  async getTransaction(id: string) {
    this.ensureStripe();

    let payment: any;
    let charge: any;
    let stripeAccount: string | undefined = undefined;

    // Check if ID is a Charge (ch_), Payment (py_), or PaymentIntent (pi_)
    try {
      if (id.startsWith('ch_')) {
        // Retrieve Charge first from platform account
        try {
          charge = await this.stripe!.charges.retrieve(id, {
            expand: [
              'payment_intent',
              'payment_intent.payment_method',
              'payment_intent.payment_method.us_bank_account',
              'payment_intent.latest_charge',
              'payment_intent.latest_charge.outcome',
              'payment_intent.latest_charge.refunds',
              'payment_intent.latest_charge.balance_transaction',
              'payment_intent.latest_charge.transfer_data',
              'payment_intent.customer',
              'payment_intent.application',
              'payment_intent.on_behalf_of',
              'payment_intent.review',
              'payment_intent.source',
              'payment_intent.transfer_data.destination',
              'refunds',
              'balance_transaction',
              'transfer_data',
              'customer',
            ],
          });
        } catch (chargeError: any) {
          // If charge retrieval fails, try to find it on Connect accounts
          if (
            chargeError.type === 'StripeInvalidRequestError' ||
            chargeError.code === 'resource_missing'
          ) {
            // Try to find the charge on Connect accounts (limit to 20 accounts for performance)
            try {
              const accounts = await this.stripe!.accounts.list({ limit: 20 });
              let foundCharge = false;

              // Try each Connect account with Promise.all for parallel requests (but limit concurrency)
              const accountPromises = accounts.data
                .slice(0, 10)
                .map(async (account) => {
                  try {
                    const connectCharge = await this.stripe!.charges.retrieve(
                      id,
                      {
                        expand: [
                          'payment_intent',
                          'payment_intent.payment_method',
                          'payment_intent.payment_method.us_bank_account',
                          'payment_intent.latest_charge',
                          'payment_intent.latest_charge.outcome',
                          'payment_intent.latest_charge.refunds',
                          'payment_intent.latest_charge.balance_transaction',
                          'payment_intent.latest_charge.transfer_data',
                          'payment_intent.customer',
                          'refunds',
                          'balance_transaction',
                          'customer',
                        ],
                      },
                      {
                        stripeAccount: account.id,
                      },
                    );

                    return { charge: connectCharge, accountId: account.id };
                  } catch (connectError: any) {
                    return null;
                  }
                });

              const results = await Promise.all(accountPromises);
              const foundResult = results.find((result) => result !== null);

              if (foundResult) {
                charge = foundResult.charge;
                stripeAccount = foundResult.accountId;
                foundCharge = true;
              }

              if (!foundCharge) {
                // Try to find the charge by searching recent PaymentIntents on platform
                try {
                  const recentPayments = await this.stripe!.paymentIntents.list(
                    {
                      limit: 100,
                      expand: ['data.latest_charge'],
                    },
                  );

                  // Look for a PaymentIntent whose latest_charge matches our charge ID
                  const foundPayment = recentPayments.data.find((pi: any) => {
                    const latestCharge = pi.latest_charge;
                    if (
                      latestCharge &&
                      typeof latestCharge === 'object' &&
                      latestCharge.id === id
                    ) {
                      return true;
                    }
                    return false;
                  });

                  if (foundPayment) {
                    // Retrieve the full PaymentIntent with all expansions
                    payment = await this.stripe!.paymentIntents.retrieve(
                      foundPayment.id,
                      {
                        expand: [
                          'payment_method',
                          'payment_method.us_bank_account',
                          'latest_charge',
                          'latest_charge.outcome',
                          'latest_charge.refunds',
                          'latest_charge.balance_transaction',
                          'latest_charge.transfer_data',
                          'latest_charge.payment_method_details',
                          'customer',
                          'application',
                          'on_behalf_of',
                          'review',
                          'source',
                          'transfer_data.destination',
                        ],
                      },
                    );
                    // Set charge from the payment's latest_charge
                    charge = payment.latest_charge;
                  } else {
                    // Re-throw the original error with more context
                    throw new Error(
                      `Charge ${id} not found. The charge might be on a Connect account, ` +
                        `or it may not exist in the current Stripe account. Original error: ${chargeError.message}`,
                    );
                  }
                } catch (searchError: any) {
                  // If search also fails, throw the original charge error
                  throw new Error(
                    `Charge ${id} not found. The charge might be on a Connect account, ` +
                      `or it may not exist in the current Stripe account. Original error: ${chargeError.message}`,
                  );
                }
              }
            } catch (searchError: any) {
              // If search also fails, throw the original charge error
              throw new Error(
                `Charge ${id} not found. The charge might be on a Connect account, ` +
                  `or it may not exist in the current Stripe account. Original error: ${chargeError.message}`,
              );
            }
          } else {
            // Re-throw non-StripeInvalidRequestError errors as-is
            throw chargeError;
          }
        }

        // Get PaymentIntent from charge if available (only if we don't already have payment)
        if (charge && charge.payment_intent && !payment) {
          const paymentIntentId =
            typeof charge.payment_intent === 'string'
              ? charge.payment_intent
              : charge.payment_intent.id;
          if (typeof charge.payment_intent === 'object') {
            payment = charge.payment_intent;
          } else {
            try {
              payment = await this.stripe!.paymentIntents.retrieve(
                paymentIntentId,
                {
                  expand: [
                    'payment_method',
                    'payment_method.us_bank_account',
                    'latest_charge',
                    'latest_charge.outcome',
                    'latest_charge.refunds',
                    'latest_charge.balance_transaction',
                    'latest_charge.transfer_data',
                    'latest_charge.payment_method_details',
                    'customer',
                    'application',
                    'on_behalf_of',
                    'review',
                    'source',
                    'transfer_data.destination',
                  ],
                },
                stripeAccount ? { stripeAccount } : undefined,
              );
            } catch (piError: any) {
              // If PaymentIntent retrieval fails and we have a Connect account, try that
              if (
                stripeAccount &&
                piError.type === 'StripeInvalidRequestError'
              ) {
                // Already tried with stripeAccount, so just use the charge
                payment = null;
              } else if (
                !stripeAccount &&
                piError.type === 'StripeInvalidRequestError'
              ) {
                // Try Connect accounts (limit to 10 for performance)
                try {
                  const accounts = await this.stripe!.accounts.list({
                    limit: 20,
                  });

                  const accountPromises = accounts.data
                    .slice(0, 10)
                    .map(async (account) => {
                      try {
                        const connectPayment =
                          await this.stripe!.paymentIntents.retrieve(
                            paymentIntentId,
                            {
                              expand: [
                                'payment_method',
                                'payment_method.us_bank_account',
                                'latest_charge',
                                'latest_charge.outcome',
                                'latest_charge.refunds',
                                'latest_charge.balance_transaction',
                                'latest_charge.transfer_data',
                                'latest_charge.payment_method_details',
                                'customer',
                              ],
                            },
                            {
                              stripeAccount: account.id,
                            },
                          );
                        return {
                          payment: connectPayment,
                          accountId: account.id,
                        };
                      } catch (connectError: any) {
                        return null;
                      }
                    });

                  const results = await Promise.all(accountPromises);
                  const foundResult = results.find((result) => result !== null);

                  if (foundResult) {
                    payment = foundResult.payment;
                    stripeAccount = foundResult.accountId;
                  } else {
                    // PaymentIntent not found, will create mock payment from charge
                    payment = null;
                  }
                } catch (searchError: any) {
                  // PaymentIntent not found, will create mock payment from charge
                  payment = null;
                }
              } else {
                throw piError;
              }
            }
          }
        }

        if (!payment) {
          // Charge without PaymentIntent - create a mock payment object from charge
          // Use the charge itself as the source of truth
          payment = {
            id: charge.id,
            amount: charge.amount,
            currency: charge.currency,
            status: charge.status === 'succeeded' ? 'succeeded' : charge.status,
            description: charge.description || undefined,
            customer: charge.customer,
            payment_method: charge.payment_method,
            created: charge.created,
            metadata: charge.metadata || {},
            amount_received: charge.amount,
            amount_capturable: 0,
            capture_method: charge.captured ? 'automatic' : 'manual',
            confirmation_method: 'automatic',
            payment_method_types: [
              charge.payment_method_details?.type || 'card',
            ],
            // Add latest_charge reference so the code below can access it
            latest_charge: charge,
          };
        }
      } else if (id.startsWith('py_')) {
        // Payment objects (py_) - These are used for certain payment methods like ACH/bank transfers
        // Payment objects are not directly retrievable via Stripe API
        // They are linked to PaymentIntents, but we need the PaymentIntent ID to retrieve them
        //
        // Solution: Try to retrieve as PaymentIntent first (sometimes the ID format allows this)
        // If that fails, we need to search through recent PaymentIntents to find the related one
        try {
          // First attempt: Try direct retrieval (might work in some cases)
          payment = await this.stripe!.paymentIntents.retrieve(id, {
            expand: [
              'payment_method',
              'payment_method.us_bank_account',
              'latest_charge',
              'latest_charge.outcome',
              'latest_charge.refunds',
              'latest_charge.balance_transaction',
              'latest_charge.transfer_data',
              'latest_charge.payment_method_details',
              'customer',
              'application',
              'on_behalf_of',
              'review',
              'source',
              'transfer_data.destination',
            ],
          });
        } catch (directError: any) {
          // Second attempt: Search through recent PaymentIntents
          // This is a workaround - we'll look through recent payments to find a match
          try {
            const recentPayments = await this.stripe!.paymentIntents.list({
              limit: 100,
              expand: ['data.payment_method', 'data.latest_charge'],
            });

            // Look for a PaymentIntent that might be related to this Payment ID
            // Check if any PaymentIntent's charge or payment method references this Payment ID
            let foundPayment = recentPayments.data.find((pi: any) => {
              const charge = pi.latest_charge;
              if (charge && typeof charge === 'object') {
                // Check various possible links
                return (
                  charge.id === id ||
                  pi.id === id ||
                  charge.payment_method_details?.us_bank_account?.payment_reference?.includes(
                    id.split('_')[1],
                  ) ||
                  (pi.metadata &&
                    Object.values(pi.metadata).some((val: any) =>
                      String(val).includes(id),
                    ))
                );
              }
              return false;
            });

            if (!foundPayment) {
              // Try searching by looking at the Payment ID pattern
              // Sometimes Payment IDs are stored in the charge's payment_method_details
              foundPayment = recentPayments.data.find((pi: any) => {
                const charge = pi.latest_charge;
                if (
                  charge &&
                  typeof charge === 'object' &&
                  charge.payment_method_details
                ) {
                  const pmDetails = charge.payment_method_details;
                  // Check if payment reference or other fields might contain the Payment ID
                  if (pmDetails.us_bank_account) {
                    const ref =
                      pmDetails.us_bank_account.payment_reference ||
                      pmDetails.us_bank_account.reference_number;
                    return (
                      ref && ref.includes(id.split('_')[1]?.substring(0, 10))
                    );
                  }
                }
                return false;
              });
            }

            if (foundPayment) {
              payment = await this.stripe!.paymentIntents.retrieve(
                foundPayment.id,
                {
                  expand: [
                    'payment_method',
                    'payment_method.us_bank_account',
                    'latest_charge',
                    'latest_charge.outcome',
                    'latest_charge.refunds',
                    'latest_charge.balance_transaction',
                    'latest_charge.transfer_data',
                    'latest_charge.payment_method_details',
                    'customer',
                    'application',
                    'on_behalf_of',
                    'review',
                    'source',
                    'transfer_data.destination',
                  ],
                },
              );
            } else {
              throw new Error(
                `Payment ${id} not found. Payment objects (py_) cannot be directly retrieved. Please use the PaymentIntent ID (pi_...) from the transaction list.`,
              );
            }
          } catch (searchError: any) {
            throw new Error(
              `Unable to retrieve Payment ${id}. Payment objects need to be accessed through their PaymentIntent ID. Please check the transaction list for the correct PaymentIntent ID (pi_...). Error: ${searchError.message}`,
            );
          }
        }
      } else {
        // Retrieve PaymentIntent directly with full expansion
        try {
          payment = await this.stripe!.paymentIntents.retrieve(id, {
            expand: [
              'payment_method',
              'payment_method.us_bank_account',
              'latest_charge',
              'latest_charge.outcome',
              'latest_charge.refunds',
              'latest_charge.balance_transaction',
              'latest_charge.transfer_data',
              'latest_charge.payment_method_details',
              'customer',
              'application',
              'on_behalf_of',
              'review',
              'source',
              'transfer_data.destination',
            ],
          });
        } catch (piError: any) {
          // If PaymentIntent retrieval fails, try Connect accounts (limit to 10 for performance)
          if (
            piError.type === 'StripeInvalidRequestError' ||
            piError.code === 'resource_missing'
          ) {
            try {
              const accounts = await this.stripe!.accounts.list({ limit: 20 });

              // Try parallel requests but limit to first 10 accounts
              const accountPromises = accounts.data
                .slice(0, 10)
                .map(async (account) => {
                  try {
                    const connectPayment =
                      await this.stripe!.paymentIntents.retrieve(
                        id,
                        {
                          expand: [
                            'payment_method',
                            'payment_method.us_bank_account',
                            'latest_charge',
                            'latest_charge.outcome',
                            'latest_charge.refunds',
                            'latest_charge.balance_transaction',
                            'latest_charge.transfer_data',
                            'latest_charge.payment_method_details',
                            'customer',
                            'application',
                            'on_behalf_of',
                            'review',
                            'source',
                            'transfer_data.destination',
                          ],
                        },
                        {
                          stripeAccount: account.id,
                        },
                      );
                    return { payment: connectPayment, accountId: account.id };
                  } catch (connectError: any) {
                    return null;
                  }
                });

              const results = await Promise.all(accountPromises);
              const foundResult = results.find((result) => result !== null);

              if (foundResult) {
                payment = foundResult.payment;
                stripeAccount = foundResult.accountId;
              } else {
                throw new Error(
                  `PaymentIntent ${id} not found. It might be on a Connect account ` +
                    `or may not exist in the current Stripe account. Original error: ${piError.message}`,
                );
              }
            } catch (searchError: any) {
              throw new Error(
                `PaymentIntent ${id} not found. It might be on a Connect account ` +
                  `or may not exist in the current Stripe account. Original error: ${piError.message}`,
              );
            }
          } else {
            throw piError;
          }
        }
      }
    } catch (error: any) {
      // Handle Stripe API errors
      if (error.type === 'StripeInvalidRequestError') {
        // Provide more detailed error message
        const errorMessage = error.message || 'Transaction not found';
        if (id.startsWith('ch_')) {
          // For charges, provide more context
          throw new Error(
            `Charge ${id} not found. ${errorMessage}. ` +
              `This charge might be on a Connect account or may not exist in the current Stripe account.`,
          );
        } else if (id.startsWith('py_')) {
          // For payment objects, the error should already be handled above
          throw error;
        } else {
          throw new Error(`Transaction not found: ${id}. ${errorMessage}`);
        }
      }
      // Re-throw the original error to preserve error details
      throw error;
    }

    // Use charge if we retrieved it directly, otherwise use latest_charge from payment
    const latestCharge = charge || (payment as any).latest_charge;
    const outcome = latestCharge?.outcome;
    const refunds = latestCharge?.refunds?.data || [];
    const balanceTransaction = latestCharge?.balance_transaction;
    const transferData = latestCharge?.transfer_data;

    return {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      description: payment.description ?? undefined,
      customer: this.extractCustomerInfo(payment),
      // Enhanced payment method with more details
      // For charges, get payment method from charge.payment_method or charge.payment_method_details
      // For payment intents, get from payment.payment_method
      payment_method: (() => {
        // If we have a charge with payment_method_details (from charge retrieval)
        if (charge && charge.payment_method_details) {
          const pmDetails = charge.payment_method_details;
          // Try to get expanded payment_method if available
          const expandedPm =
            typeof charge.payment_method === 'object' &&
            charge.payment_method !== null
              ? charge.payment_method
              : null;

          return {
            id: expandedPm?.id || charge.payment_method || undefined,
            object: expandedPm?.object || 'payment_method',
            allow_redisplay: expandedPm?.allow_redisplay || undefined,
            created: expandedPm?.created || undefined,
            customer: expandedPm?.customer || charge.customer || undefined,
            livemode: expandedPm?.livemode || charge.livemode || false,
            metadata: expandedPm?.metadata || charge.metadata || {},
            type: pmDetails.type,
            card: pmDetails.card
              ? {
                  brand: pmDetails.card.brand,
                  last4: pmDetails.card.last4,
                  exp_month:
                    expandedPm?.card?.exp_month || pmDetails.card.exp_month,
                  exp_year:
                    expandedPm?.card?.exp_year || pmDetails.card.exp_year,
                  funding: expandedPm?.card?.funding || pmDetails.card.funding,
                  fingerprint:
                    pmDetails.card.fingerprint || expandedPm?.card?.fingerprint,
                  country: pmDetails.card.country || expandedPm?.card?.country,
                  network: pmDetails.card.network || expandedPm?.card?.network,
                  checks: pmDetails.card.checks
                    ? {
                        cvc_check: pmDetails.card.checks.cvc_check,
                        address_line1_check:
                          pmDetails.card.checks.address_line1_check,
                        address_postal_code_check:
                          pmDetails.card.checks.address_postal_code_check,
                      }
                    : undefined,
                  wallet: pmDetails.card.wallet || expandedPm?.card?.wallet,
                }
              : undefined,
            us_bank_account: pmDetails.us_bank_account
              ? {
                  account_holder_type:
                    expandedPm?.us_bank_account?.account_holder_type,
                  account_type: expandedPm?.us_bank_account?.account_type,
                  bank_name:
                    pmDetails.us_bank_account.bank_name ||
                    expandedPm?.us_bank_account?.bank_name,
                  financial_connections_account:
                    expandedPm?.us_bank_account
                      ?.financial_connections_account || null,
                  fingerprint: expandedPm?.us_bank_account?.fingerprint,
                  last4:
                    pmDetails.us_bank_account.last4 ||
                    expandedPm?.us_bank_account?.last4,
                  networks:
                    expandedPm?.us_bank_account?.networks ||
                    pmDetails.us_bank_account.networks ||
                    undefined,
                  routing_number:
                    pmDetails.us_bank_account.routing_number ||
                    expandedPm?.us_bank_account?.routing_number,
                  status_details:
                    expandedPm?.us_bank_account?.status_details || {},
                }
              : expandedPm?.us_bank_account
                ? {
                    account_holder_type:
                      expandedPm.us_bank_account.account_holder_type,
                    account_type: expandedPm.us_bank_account.account_type,
                    bank_name: expandedPm.us_bank_account.bank_name,
                    financial_connections_account:
                      expandedPm.us_bank_account
                        .financial_connections_account || null,
                    fingerprint: expandedPm.us_bank_account.fingerprint,
                    last4: expandedPm.us_bank_account.last4,
                    networks: expandedPm.us_bank_account.networks || undefined,
                    routing_number: expandedPm.us_bank_account.routing_number,
                    status_details:
                      expandedPm.us_bank_account.status_details || {},
                  }
                : undefined,
            billing_details:
              charge.billing_details || expandedPm?.billing_details
                ? {
                    name:
                      charge.billing_details?.name ||
                      expandedPm?.billing_details?.name,
                    email:
                      charge.billing_details?.email ||
                      expandedPm?.billing_details?.email,
                    phone:
                      charge.billing_details?.phone ||
                      expandedPm?.billing_details?.phone,
                    address:
                      charge.billing_details?.address ||
                      expandedPm?.billing_details?.address
                        ? {
                            line1: (
                              charge.billing_details?.address ||
                              expandedPm?.billing_details?.address
                            )?.line1,
                            line2: (
                              charge.billing_details?.address ||
                              expandedPm?.billing_details?.address
                            )?.line2,
                            city: (
                              charge.billing_details?.address ||
                              expandedPm?.billing_details?.address
                            )?.city,
                            state: (
                              charge.billing_details?.address ||
                              expandedPm?.billing_details?.address
                            )?.state,
                            postal_code: (
                              charge.billing_details?.address ||
                              expandedPm?.billing_details?.address
                            )?.postal_code,
                            country: (
                              charge.billing_details?.address ||
                              expandedPm?.billing_details?.address
                            )?.country,
                          }
                        : undefined,
                  }
                : undefined,
          };
        }
        // For PaymentIntent
        if ((payment as any).payment_method) {
          const pm = (payment as any).payment_method;
          return {
            id: pm.id,
            object: pm.object || 'payment_method',
            allow_redisplay: pm.allow_redisplay || undefined,
            created: pm.created || undefined,
            customer: pm.customer || payment.customer || undefined,
            livemode: pm.livemode || payment.livemode || false,
            metadata: pm.metadata || {},
            type: pm.type,
            card: pm.card
              ? {
                  brand: pm.card.brand,
                  last4: pm.card.last4,
                  exp_month: pm.card.exp_month,
                  exp_year: pm.card.exp_year,
                  funding: pm.card.funding,
                  fingerprint: pm.card.fingerprint,
                  country: pm.card.country,
                  network: pm.card.network,
                  checks: pm.card.checks
                    ? {
                        cvc_check: pm.card.checks.cvc_check,
                        address_line1_check: pm.card.checks.address_line1_check,
                        address_postal_code_check:
                          pm.card.checks.address_postal_code_check,
                      }
                    : undefined,
                  wallet: pm.card.wallet,
                }
              : undefined,
            us_bank_account: pm.us_bank_account
              ? {
                  account_holder_type: pm.us_bank_account.account_holder_type,
                  account_type: pm.us_bank_account.account_type,
                  bank_name: pm.us_bank_account.bank_name,
                  financial_connections_account:
                    pm.us_bank_account.financial_connections_account || null,
                  fingerprint: pm.us_bank_account.fingerprint,
                  last4: pm.us_bank_account.last4,
                  networks: pm.us_bank_account.networks || undefined,
                  routing_number: pm.us_bank_account.routing_number,
                  status_details: pm.us_bank_account.status_details || {},
                }
              : undefined,
            billing_details: pm.billing_details
              ? {
                  name: pm.billing_details.name,
                  email: pm.billing_details.email,
                  phone: pm.billing_details.phone,
                  address: pm.billing_details.address
                    ? {
                        line1: pm.billing_details.address.line1,
                        line2: pm.billing_details.address.line2,
                        city: pm.billing_details.address.city,
                        state: pm.billing_details.address.state,
                        postal_code: pm.billing_details.address.postal_code,
                        country: pm.billing_details.address.country,
                      }
                    : undefined,
                }
              : undefined,
          };
        }
        return undefined;
      })(),
      created: payment.created,
      metadata: (payment.metadata || {}) as Record<string, string>,
      fee: (payment as any).application_fee_amount || 0,
      net: payment.amount - ((payment as any).application_fee_amount || 0),
      amount_received: payment.amount_received ?? payment.amount,
      amount_capturable: payment.amount_capturable ?? 0,
      capture_method: payment.capture_method || 'automatic',
      confirmation_method: payment.confirmation_method || 'automatic',
      payment_method_types: payment.payment_method_types || [],

      // NEW FIELDS based on ChatGPT recommendations
      // Decline reason and failure details
      decline_reason: outcome?.reason || outcome?.failure_code || undefined,
      failure_message: outcome?.failure_message || undefined,
      risk_level: outcome?.risk_level || undefined,

      // Refund information
      refunded_amount: refunds.reduce(
        (sum: number, refund: any) => sum + refund.amount,
        0,
      ),
      refunded_date: refunds.length > 0 ? refunds[0].created : undefined,
      refund_count: refunds.length,
      refunds: refunds.map((refund: any) => ({
        id: refund.id,
        amount: refund.amount,
        created: refund.created,
        reason: refund.reason,
        status: refund.status,
      })),

      // Settlement and transfer information
      settlement_merchant:
        transferData?.destination ||
        balanceTransaction?.destination ||
        undefined,
      transferred_to: transferData?.destination || undefined,

      // Terminal information (if available in metadata)
      terminal_location:
        payment.metadata?.terminal_location ||
        payment.metadata?.location_id ||
        undefined,
      terminal_reader:
        payment.metadata?.terminal_reader ||
        payment.metadata?.reader_id ||
        undefined,

      // Balance transaction details
      balance_transaction_id: balanceTransaction?.id || undefined,
      net_amount:
        balanceTransaction?.net ||
        payment.amount - ((payment as any).application_fee_amount || 0),
      fee_details: balanceTransaction?.fee_details || undefined,
      // Calculate Stripe processing fees from balance transaction
      stripe_fee: balanceTransaction?.fee || 0,
      // Payment reference (from charge payment method details for us_bank_account)
      payment_reference:
        latestCharge?.payment_method_details?.us_bank_account
          ?.payment_reference ||
        latestCharge?.payment_method_details?.us_bank_account
          ?.reference_number ||
        latestCharge?.payment_method_details?.us_bank_account?.mandate
          ?.payment_method_details?.us_bank_account?.payment_reference ||
        charge?.payment_method_details?.us_bank_account?.payment_reference ||
        charge?.payment_method_details?.us_bank_account?.reference_number ||
        undefined,

      // Charge reference
      charge_id: latestCharge?.id || undefined,

      // Full PaymentIntent fields matching Stripe API structure
      object: payment.object || 'payment_intent',
      amount_details: payment.amount_details || undefined,
      application: payment.application || null,
      application_fee_amount: payment.application_fee_amount || null,
      automatic_payment_methods: payment.automatic_payment_methods || null,
      canceled_at: payment.canceled_at || null,
      cancellation_reason: payment.cancellation_reason || null,
      client_secret: payment.client_secret || undefined,
      excluded_payment_method_types:
        payment.excluded_payment_method_types || null,
      last_payment_error: payment.last_payment_error || null,
      livemode: payment.livemode || false,
      next_action: payment.next_action || null,
      on_behalf_of: payment.on_behalf_of || null,
      payment_method_configuration_details:
        payment.payment_method_configuration_details || null,
      payment_method_options: payment.payment_method_options || undefined,
      processing: payment.processing || null,
      receipt_email: payment.receipt_email || null,
      review: payment.review || null,
      setup_future_usage: payment.setup_future_usage || null,
      shipping: payment.shipping || null,
      source: payment.source || null,
      statement_descriptor: payment.statement_descriptor || undefined,
      statement_descriptor_suffix: payment.statement_descriptor_suffix || null,
      transfer_data: payment.transfer_data || null,
      transfer_group:
        payment.transfer_group || latestCharge?.transfer_group || null,
      latest_charge_id:
        typeof payment.latest_charge === 'string'
          ? payment.latest_charge
          : payment.latest_charge?.id || undefined,
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

  async getAllTransactionsWithSummary() {
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

    // First, get Payment Intents from the platform account with enhanced expansions
    const platformPayments = await this.stripe!.paymentIntents.list({
      limit: 100, // Stripe's maximum limit
      expand: [
        'data.payment_method',
        'data.latest_charge',
        'data.latest_charge.outcome',
        'data.latest_charge.refunds',
        'data.latest_charge.balance_transaction',
        'data.latest_charge.transfer_data',
        'data.customer',
      ],
    });

    // Also get Charges from the platform account (these are what show in Stripe dashboard)
    console.log('Fetching charges from platform account...');
    const platformCharges = await this.stripe!.charges.list({
      limit: 100, // Stripe's maximum limit
      expand: ['data.customer', 'data.refunds', 'data.balance_transaction'], // Expand customer, refunds, and balance_transaction
    });

    console.log(`Platform Payment Intents: ${platformPayments.data.length}`);
    console.log(`Platform Charges: ${platformCharges.data.length}`);

    // Fetch additional pages for Payment Intents
    let allPlatformPayments = [...platformPayments.data];
    let hasMore = platformPayments.has_more;
    let startingAfter =
      platformPayments.data[platformPayments.data.length - 1]?.id;

    while (hasMore && allPlatformPayments.length < 1000) {
      try {
        const nextPage = await this.stripe!.paymentIntents.list({
          limit: 100,
          starting_after: startingAfter,
          expand: [
            'data.payment_method',
            'data.latest_charge',
            'data.latest_charge.outcome',
            'data.latest_charge.refunds',
            'data.latest_charge.balance_transaction',
            'data.latest_charge.transfer_data',
            'data.customer',
          ],
        });

        allPlatformPayments = [...allPlatformPayments, ...nextPage.data];
        hasMore = nextPage.has_more;
        startingAfter = nextPage.data[nextPage.data.length - 1]?.id;

        console.log(
          `Fetched additional ${nextPage.data.length} payment intents from platform account. Total: ${allPlatformPayments.length}`,
        );
      } catch (error) {
        console.error(
          'Error fetching additional platform payment intents:',
          error,
        );
        break;
      }
    }

    // Fetch additional pages for Charges
    let allPlatformCharges = [...platformCharges.data];
    let chargesHasMore = platformCharges.has_more;
    let chargesStartingAfter =
      platformCharges.data[platformCharges.data.length - 1]?.id;

    while (chargesHasMore && allPlatformCharges.length < 1000) {
      try {
        const nextChargesPage = await this.stripe!.charges.list({
          limit: 100,
          starting_after: chargesStartingAfter,
          expand: ['data.customer', 'data.refunds', 'data.balance_transaction'], // Expand customer, refunds, and balance_transaction
        });

        allPlatformCharges = [...allPlatformCharges, ...nextChargesPage.data];
        chargesHasMore = nextChargesPage.has_more;
        chargesStartingAfter =
          nextChargesPage.data[nextChargesPage.data.length - 1]?.id;

        console.log(
          `Fetched additional ${nextChargesPage.data.length} charges from platform account. Total: ${allPlatformCharges.length}`,
        );
      } catch (error) {
        console.error('Error fetching additional platform charges:', error);
        break;
      }
    }

    console.log(
      `Platform account: ${allPlatformPayments.length} payment intents + ${allPlatformCharges.length} charges (including pagination)`,
    );

    // Convert Payment Intents to our transaction format with enhanced fields
    const platformPaymentTransactions = allPlatformPayments.map((payment) => {
      const latestCharge = (payment as any).latest_charge;
      const outcome = latestCharge?.outcome;
      const refunds = latestCharge?.refunds?.data || [];
      const balanceTransaction = latestCharge?.balance_transaction;
      const transferData = latestCharge?.transfer_data;

      return {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        description: payment.description ?? undefined,
        customer: this.extractCustomerInfo(payment),
        // Enhanced payment method with more details
        payment_method: (payment as any).payment_method
          ? {
              type: (payment as any).payment_method.type,
              card: (payment as any).payment_method.card
                ? {
                    brand: (payment as any).payment_method.card.brand,
                    last4: (payment as any).payment_method.card.last4,
                    exp_month: (payment as any).payment_method.card.exp_month,
                    exp_year: (payment as any).payment_method.card.exp_year,
                    funding: (payment as any).payment_method.card.funding,
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

        // NEW FIELDS based on ChatGPT recommendations
        // Decline reason and failure details
        decline_reason: outcome?.reason || outcome?.failure_code || undefined,
        failure_message: outcome?.failure_message || undefined,
        risk_level: outcome?.risk_level || undefined,

        // Refund information
        refunded_amount: refunds.reduce(
          (sum: number, refund: any) => sum + refund.amount,
          0,
        ),
        refunded_date: refunds.length > 0 ? refunds[0].created : undefined,
        refund_count: refunds.length,
        refunds: refunds.map((refund: any) => ({
          id: refund.id,
          amount: refund.amount,
          created: refund.created,
          reason: refund.reason,
          status: refund.status,
        })),

        // Settlement and transfer information
        settlement_merchant:
          transferData?.destination ||
          balanceTransaction?.destination ||
          undefined,
        transferred_to: transferData?.destination || undefined,
        transfer_group: latestCharge?.transfer_group || undefined,

        // Terminal information (if available in metadata)
        terminal_location:
          payment.metadata?.terminal_location ||
          payment.metadata?.location_id ||
          undefined,
        terminal_reader:
          payment.metadata?.terminal_reader ||
          payment.metadata?.reader_id ||
          undefined,

        // Balance transaction details
        balance_transaction_id: balanceTransaction?.id || undefined,
        net_amount:
          balanceTransaction?.net ||
          payment.amount - ((payment as any).application_fee_amount || 0),
        fee_details: balanceTransaction?.fee_details || undefined,

        // Charge reference
        charge_id: latestCharge?.id || undefined,
      };
    });

    // Convert Charges to our transaction format
    const platformChargeTransactions = allPlatformCharges.map((charge) => {
      const refunds = charge.refunds?.data || [];
      const balanceTransaction = charge.balance_transaction;
      const isRefunded = charge.refunded || refunds.length > 0;
      const refundedAmount =
        charge.amount_refunded ||
        refunds.reduce(
          (sum: number, refund: any) => sum + (refund.amount || 0),
          0,
        );

      // Handle balance transaction - it can be a string ID or an expanded object
      let balanceTransactionDetails: any = undefined;
      if (
        balanceTransaction &&
        typeof balanceTransaction === 'object' &&
        balanceTransaction !== null
      ) {
        balanceTransactionDetails = {
          id: (balanceTransaction as any).id,
          amount: (balanceTransaction as any).amount,
          available_on: (balanceTransaction as any).available_on,
          created: (balanceTransaction as any).created,
          currency: (balanceTransaction as any).currency,
          description: (balanceTransaction as any).description,
          exchange_rate: (balanceTransaction as any).exchange_rate,
          fee: (balanceTransaction as any).fee,
          fee_details: (balanceTransaction as any).fee_details,
          net: (balanceTransaction as any).net,
          reporting_category: (balanceTransaction as any).reporting_category,
          status: (balanceTransaction as any).status,
          type: (balanceTransaction as any).type,
        };
      }

      // Extract payment method details with more card information
      let paymentMethodDetails: any = undefined;
      if (charge.payment_method_details) {
        paymentMethodDetails = {
          type: charge.payment_method_details.type,
          card: charge.payment_method_details.card
            ? {
                brand: charge.payment_method_details.card.brand,
                last4: charge.payment_method_details.card.last4,
                exp_month: charge.payment_method_details.card.exp_month,
                exp_year: charge.payment_method_details.card.exp_year,
                funding: charge.payment_method_details.card.funding,
                country: charge.payment_method_details.card.country,
                fingerprint: charge.payment_method_details.card.fingerprint,
                network: charge.payment_method_details.card.network,
                network_transaction_id:
                  charge.payment_method_details.card.network_transaction_id,
                authorization_code:
                  charge.payment_method_details.card.authorization_code,
                checks: charge.payment_method_details.card.checks,
              }
            : undefined,
        };
      }

      return {
        id: charge.id,
        object: charge.object || 'charge',
        amount: charge.amount,
        amount_captured: charge.amount_captured,
        amount_refunded: charge.amount_refunded,
        currency: charge.currency,
        status: charge.status === 'succeeded' ? 'succeeded' : charge.status,
        description:
          charge.description ?? charge.metadata?.description ?? undefined,
        customer: this.extractCustomerInfo(charge),
        payment_method: paymentMethodDetails,
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
        // Additional charge fields
        is_refunded: isRefunded,
        refunded_amount: refundedAmount,
        decline_reason:
          charge.outcome?.reason || charge.failure_code || undefined,
        failure_message: charge.failure_message || undefined,
        failure_code: charge.failure_code || undefined,
        failure_balance_transaction:
          charge.failure_balance_transaction || undefined,
        risk_level: charge.outcome?.risk_level || undefined,
        outcome: charge.outcome
          ? {
              network_status: charge.outcome.network_status,
              reason: charge.outcome.reason,
              risk_level: charge.outcome.risk_level,
              risk_score: charge.outcome.risk_score,
              seller_message: charge.outcome.seller_message,
              type: charge.outcome.type,
              advice_code: charge.outcome.advice_code,
              network_advice_code: charge.outcome.network_advice_code,
              network_decline_code: charge.outcome.network_decline_code,
            }
          : undefined,
        balance_transaction: balanceTransactionDetails,
        balance_transaction_id:
          typeof balanceTransaction === 'string'
            ? balanceTransaction
            : balanceTransaction?.id,
        application: charge.application || null,
        application_fee: charge.application_fee || null,
        application_fee_amount: charge.application_fee_amount || null,
        billing_details: charge.billing_details
          ? {
              address: charge.billing_details.address
                ? {
                    city: charge.billing_details.address.city,
                    country: charge.billing_details.address.country,
                    line1: charge.billing_details.address.line1,
                    line2: charge.billing_details.address.line2,
                    postal_code: charge.billing_details.address.postal_code,
                    state: charge.billing_details.address.state,
                  }
                : undefined,
              email: charge.billing_details.email,
              name: charge.billing_details.name,
              phone: charge.billing_details.phone,
              tax_id: charge.billing_details.tax_id,
            }
          : undefined,
        calculated_statement_descriptor:
          charge.calculated_statement_descriptor || undefined,
        statement_descriptor: charge.statement_descriptor || undefined,
        statement_descriptor_suffix:
          charge.statement_descriptor_suffix || undefined,
        captured: charge.captured,
        paid: charge.paid,
        dispute: (charge as any).dispute || null,
        disputed: charge.disputed || false,
        payment_intent:
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id || undefined,
        receipt_email: charge.receipt_email || undefined,
        receipt_number: charge.receipt_number || undefined,
        receipt_url: charge.receipt_url || undefined,
        refunds: refunds.map((refund: any) => ({
          id: refund.id,
          amount: refund.amount,
          created: refund.created,
          currency: refund.currency,
          reason: refund.reason,
          status: refund.status,
        })),
        review: charge.review || null,
        shipping: charge.shipping || null,
        source: charge.source || null,
        source_transfer: charge.source_transfer || null,
        transfer_data: charge.transfer_data || null,
        transfer_group: charge.transfer_group || null,
        on_behalf_of: charge.on_behalf_of || null,
        order: (charge as any).order || null,
        livemode: charge.livemode || false,
      };
    });

    // Combine payment intents and charges
    const platformTransactions = [
      ...platformPaymentTransactions,
      ...platformChargeTransactions,
    ];
    allTransactions = [...platformTransactions];

    // Only fetch platform account transactions (no connected accounts)
    // Removed connected accounts logic - only showing platform data

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
        const existingTransaction = deduplicatedTransactions.find(
          (t) => t.id === existingTransactionId,
        );

        // Prefer Payment Intents over Charges when we have both
        if (
          transaction.id.startsWith('pi_') &&
          existingTransaction?.id.startsWith('ch_')
        ) {
          // Replace the charge with the payment intent
          const index = deduplicatedTransactions.findIndex(
            (t) => t.id === existingTransactionId,
          );
          if (index !== -1) {
            deduplicatedTransactions[index] = transaction;
            seenAmounts.set(key, transaction.id);
          }
        }
        // If both are the same type or we prefer the existing one, skip this transaction
      }
    }

    console.log(
      `Deduplicated transactions: ${allTransactions.length} -> ${deduplicatedTransactions.length}`,
    );

    // Calculate summary
    allSummary = deduplicatedTransactions.reduce(
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
          case 'requires_payment_method':
          case 'requires_confirmation':
          case 'requires_action':
            acc.uncaptured++;
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

    console.log(
      `Total transactions from all accounts: ${deduplicatedTransactions.length}`,
    );
    console.log('Summary:', allSummary);
    console.log(
      'Transaction IDs:',
      deduplicatedTransactions.map((t) => t.id),
    );

    return {
      transactions: {
        data: deduplicatedTransactions,
        has_more: false, // We're fetching all available
        total_count: deduplicatedTransactions.length,
      },
      summary: allSummary,
    };
  }

  async listPayouts(params: {
    limit?: number;
    starting_after?: string;
    ending_before?: string;
  }) {
    this.ensureStripe();

    // Use caching for better performance
    const cacheKey = `list_payouts_${params?.limit || 200}_${params?.starting_after || 'none'}_${params?.ending_before || 'none'}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const payouts = await this.stripe!.payouts.list({
      limit: Math.min(params?.limit ?? 100, 100), // Cap at 100 for performance
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

    const result = {
      data: formattedPayouts,
      has_more: payouts.has_more,
      total_count: formattedPayouts.length,
    };

    // Cache for 5 minutes (payouts change less frequently)
    this.cache.set(cacheKey, result, 300000);

    return result;
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

  async getAllPayoutsWithSummary() {
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
    let startingAfter =
      platformPayouts.data[platformPayouts.data.length - 1]?.id;

    while (hasMore && allPlatformPayouts.length < 1000) {
      try {
        const nextPage = await this.stripe!.payouts.list({
          limit: 100,
          starting_after: startingAfter,
        });

        allPlatformPayouts = [...allPlatformPayouts, ...nextPage.data];
        hasMore = nextPage.has_more;
        startingAfter = nextPage.data[nextPage.data.length - 1]?.id;

        console.log(
          `Fetched additional ${nextPage.data.length} payouts from platform account. Total: ${allPlatformPayouts.length}`,
        );
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

    // Only fetch platform account payouts (no connected accounts)
    // Removed connected accounts logic - only showing platform data

    // Sort by creation date
    allPayouts.sort((a, b) => b.created - a.created);

    console.log(`Total payouts from platform account: ${allPayouts.length}`);

    // Calculate summary
    allSummary = allPayouts.reduce(
      (acc, payout) => {
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
      },
      {
        total: 0,
        paid: 0,
        pending: 0,
        in_transit: 0,
        canceled: 0,
        failed: 0,
      },
    );

    console.log('Payout Summary:', allSummary);

    return {
      payouts: {
        data: allPayouts,
        has_more: false, // We're fetching all available
        total_count: allPayouts.length,
      },
      summary: allSummary,
    };
  }

  async getConnectedAccounts() {
    this.ensureStripe();
    const accounts = await this.stripe!.accounts.list({ limit: 100 });
    console.log(`Found ${accounts.data.length} connected accounts`);

    return {
      accounts: accounts.data.map((acc) => ({
        id: acc.id,
        email: acc.email,
        country: acc.country,
        type: acc.type,
        business_type: acc.business_type,
        charges_enabled: acc.charges_enabled,
        payouts_enabled: acc.payouts_enabled,
      })),
      total: accounts.data.length,
    };
  }

  /**
   * Get all customers from platform account - optimized version
   * Uses ONLY: /v1/customers endpoint
   */
  async getAllCustomersFast(params: { limit?: number; page?: number }) {
    this.ensureStripe();

    const limit = Math.min(params?.limit || 50, 100);
    const page = params?.page || 1;

    try {
      // Get platform account customers only
      // API Endpoint: /v1/customers
      console.log(
        `Fetching platform customers from /v1/customers (limit: ${limit})...`,
      );

      const platformCustomers = await this.stripe!.customers.list({
        limit: 100, // Fetch more to get accurate count, but we'll limit the response
      });

      // Log what Stripe actually returned
      console.log(
        `Stripe returned ${platformCustomers.data.length} customers, has_more: ${platformCustomers.has_more}`,
      );

      const formattedCustomers = platformCustomers.data.map((customer) => ({
        id: customer.id,
        object: customer.object,
        address: customer.address
          ? {
              city: customer.address.city || null,
              country: customer.address.country || null,
              line1: customer.address.line1 || null,
              line2: customer.address.line2 || null,
              postal_code: customer.address.postal_code || null,
              state: customer.address.state || null,
            }
          : null,
        balance: customer.balance || 0,
        created: customer.created,
        currency: customer.currency || null,
        default_source: customer.default_source || null,
        delinquent: customer.delinquent || false,
        description: customer.description || null,
        discount: customer.discount || null,
        email: customer.email || null,
        invoice_prefix: customer.invoice_prefix || null,
        invoice_settings: customer.invoice_settings
          ? {
              custom_fields: customer.invoice_settings.custom_fields || null,
              default_payment_method:
                customer.invoice_settings.default_payment_method || null,
              footer: customer.invoice_settings.footer || null,
              rendering_options:
                customer.invoice_settings.rendering_options || null,
            }
          : null,
        livemode: customer.livemode || false,
        metadata: customer.metadata || {},
        name: customer.name || null,
        next_invoice_sequence: customer.next_invoice_sequence || 1,
        phone: customer.phone || null,
        preferred_locales: customer.preferred_locales || [],
        shipping: customer.shipping
          ? {
              address: customer.shipping.address
                ? {
                    city: customer.shipping.address.city || null,
                    country: customer.shipping.address.country || null,
                    line1: customer.shipping.address.line1 || null,
                    line2: customer.shipping.address.line2 || null,
                    postal_code: customer.shipping.address.postal_code || null,
                    state: customer.shipping.address.state || null,
                  }
                : null,
              name: customer.shipping.name || null,
              phone: customer.shipping.phone || null,
            }
          : null,
        tax_exempt: customer.tax_exempt || 'none',
        test_clock: customer.test_clock || null,
      }));

      // Remove duplicates by ID (in case of any issues)
      const uniqueCustomers = formattedCustomers.filter(
        (customer, index, self) =>
          index === self.findIndex((c) => c.id === customer.id),
      );

      console.log(
        `After deduplication: ${uniqueCustomers.length} unique customers (was ${formattedCustomers.length})`,
      );

      // Sort by creation date (newest first)
      uniqueCustomers.sort((a, b) => b.created - a.created);

      // Apply pagination on the backend side
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedCustomers = uniqueCustomers.slice(startIndex, endIndex);

      console.log(
        `Page ${page}: Showing customers ${startIndex + 1} to ${Math.min(endIndex, uniqueCustomers.length)} of ${uniqueCustomers.length} total`,
      );

      // Calculate summary from ALL customers (not just current page)
      const summary = uniqueCustomers.reduce(
        (acc, customer) => {
          acc.total++;
          if (customer.delinquent) {
            acc.delinquent++;
          }
          if (customer.email) {
            acc.with_email++;
          }
          if (customer.phone) {
            acc.with_phone++;
          }
          if (customer.balance && customer.balance > 0) {
            acc.with_balance++;
          }
          return acc;
        },
        {
          total: 0,
          delinquent: 0,
          with_email: 0,
          with_phone: 0,
          with_balance: 0,
        },
      );

      const result = {
        customers: {
          data: paginatedCustomers,
          has_more: endIndex < uniqueCustomers.length,
          total_count: uniqueCustomers.length,
        },
        summary,
      };

      console.log(
        `Total customers: ${uniqueCustomers.length} unique, returning ${paginatedCustomers.length} for page ${page}`,
      );
      return result;
    } catch (error) {
      console.error('Error fetching all customers:', error);
      throw error;
    }
  }

  /**
   * Get volume data for dashboard graphs (gross and net volume over time)
   */
  async getVolumeData(params?: {
    days?: number; // Number of days to look back (default: 1 for today)
    groupBy?: 'hour' | 'day'; // Group by hour or day (default: 'hour' for today, 'day' for longer periods)
    date?: Date; // Specific date to filter by (for a single day)
  }) {
    this.ensureStripe();

    // Determine start and end times
    let startTime: number;
    let endTime: number;

    if (params?.date) {
      // Use specific date - get data for that entire day
      const selectedDate = new Date(params.date);
      selectedDate.setHours(0, 0, 0, 0);
      startTime = Math.floor(selectedDate.getTime() / 1000);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      endTime = Math.floor(endOfDay.getTime() / 1000);
    } else {
      // Use days parameter
      const days = params?.days || 1;
      const now = Math.floor(Date.now() / 1000);
      endTime = now;
      startTime = now - days * 24 * 60 * 60;
    }

    // Determine groupBy - always use 'hour' for single day, 'day' for multiple days
    const dateRange = endTime - startTime;
    const daysInRange = dateRange / (24 * 60 * 60);
    const groupBy = params?.groupBy || (daysInRange <= 1 ? 'hour' : 'day');

    const cacheKey = `volume_data_${startTime}_${endTime}_${groupBy}`;

    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(
        `Cache hit for volume data: ${startTime}_${endTime}_${groupBy}`,
      );
      return cached;
    }

    try {
      // Fetch payment intents with latest_charge expanded to get net amounts
      const payments = await this.stripe!.paymentIntents.list({
        limit: 100,
        created: { gte: startTime, lte: endTime },
        expand: ['data.latest_charge.balance_transaction'],
      });

      // Fetch customers created in the same time period
      const customers = await this.stripe!.customers.list({
        limit: 100,
        created: { gte: startTime, lte: endTime },
      });

      // Group data by time period
      const volumeMap = new Map<
        string,
        { gross: number; net: number; count: number; newCustomers: number }
      >();

      payments.data.forEach((payment) => {
        if (payment.status !== 'succeeded') return;

        const created = payment.created;
        let timeKey: string;

        if (groupBy === 'hour') {
          const date = new Date(created * 1000);
          const hour = date.getHours();
          const dateStr = date.toISOString().split('T')[0];
          timeKey = `${dateStr} ${hour.toString().padStart(2, '0')}:00`;
        } else {
          const date = new Date(created * 1000);
          timeKey = date.toISOString().split('T')[0];
        }

        const gross = payment.amount || 0;

        // Get net amount from balance transaction (amount after fees)
        let net = gross;
        const paymentAny = payment as any;
        const balanceTransaction =
          paymentAny.latest_charge?.balance_transaction;

        if (balanceTransaction && typeof balanceTransaction === 'object') {
          net = balanceTransaction.net || gross;
        } else {
          // Fallback: estimate net as gross minus 2.9% + $0.30 (typical Stripe fee)
          net = Math.round(gross * 0.971 - 30);
        }

        const existing = volumeMap.get(timeKey) || {
          gross: 0,
          net: 0,
          count: 0,
          newCustomers: 0,
        };
        volumeMap.set(timeKey, {
          gross: existing.gross + gross,
          net: existing.net + net,
          count: existing.count + 1,
          newCustomers: existing.newCustomers,
        });
      });

      // Count new customers by time period
      customers.data.forEach((customer) => {
        const created = customer.created;
        let timeKey: string;

        if (groupBy === 'hour') {
          const date = new Date(created * 1000);
          const hour = date.getHours();
          const dateStr = date.toISOString().split('T')[0];
          timeKey = `${dateStr} ${hour.toString().padStart(2, '0')}:00`;
        } else {
          const date = new Date(created * 1000);
          timeKey = date.toISOString().split('T')[0];
        }

        const existing = volumeMap.get(timeKey) || {
          gross: 0,
          net: 0,
          count: 0,
          newCustomers: 0,
        };
        volumeMap.set(timeKey, {
          ...existing,
          newCustomers: existing.newCustomers + 1,
        });
      });

      // Convert to array and sort by time
      const volumeData = Array.from(volumeMap.entries())
        .map(([time, data]) => ({
          time,
          gross: data.gross / 100, // Convert cents to dollars
          net: data.net / 100, // Convert cents to dollars
          count: data.count,
          newCustomers: data.newCustomers,
        }))
        .sort((a, b) => a.time.localeCompare(b.time));

      // Calculate totals
      const totals = volumeData.reduce(
        (acc, item) => ({
          gross: acc.gross + item.gross,
          net: acc.net + item.net,
          count: acc.count + item.count,
          newCustomers: acc.newCustomers + item.newCustomers,
        }),
        { gross: 0, net: 0, count: 0, newCustomers: 0 },
      );

      const result = {
        data: volumeData,
        totals,
        period: {
          days: Math.ceil((endTime - startTime) / (24 * 60 * 60)),
          groupBy,
          startTime,
          endTime,
        },
      };

      // Cache for 2 minutes
      this.cache.set(cacheKey, result, 120000);

      return result;
    } catch (error) {
      console.error('Error fetching volume data:', error);
      throw error;
    }
  }
}
