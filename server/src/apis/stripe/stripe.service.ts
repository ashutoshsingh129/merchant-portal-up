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
        customer: payment.customer
          ? {
              id: String(payment.customer),
              email: payment.receipt_email,
            }
          : undefined,
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
      // Get platform account transactions only
      // API Endpoint: /v1/payment_intents
      console.log(
        `Fetching fresh transactions from /v1/payment_intents (limit: ${limit})...`,
      );
      const platformPayments = await this.stripe!.paymentIntents.list({
        limit: 100, // Fetch all to get accurate count
        expand: ['data.customer', 'data.latest_charge.refunds', 'data.payment_method'],
      });

      console.log(
        `Stripe returned ${platformPayments.data.length} payment intents, has_more: ${platformPayments.has_more}`,
      );

      const platformTransactions = platformPayments.data.map((payment) => {
        // Check if payment has refunds by checking the latest charge
        let isRefunded = false;
        let refundedAmount = 0;

        // Access latest_charge through the payment object (may be expanded)
        const paymentAny = payment as any;
        const latestCharge = paymentAny.latest_charge;

        if (latestCharge) {
          // If latest_charge is expanded, it's an object; otherwise it's a string ID
          if (typeof latestCharge === 'object' && latestCharge !== null) {
            // Charge is expanded, check for refunds
            if (latestCharge.refunded) {
              isRefunded = true;
              refundedAmount += latestCharge.amount_refunded || 0;
            } else if (
              latestCharge.refunds &&
              latestCharge.refunds.data &&
              latestCharge.refunds.data.length > 0
            ) {
              isRefunded = true;
              refundedAmount += latestCharge.refunds.data.reduce(
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
          description: payment.description,
          customer: payment.customer
            ? {
                id: String(payment.customer),
                email: payment.receipt_email,
              }
            : undefined,
          created: payment.created,
          metadata: payment.metadata,
          stripe_account: 'platform',
          is_refunded: isRefunded,
          refunded_amount: refundedAmount,
          payment_method: paymentMethodType ? {
            type: paymentMethodType,
            card: paymentMethodCard,
          } : undefined,
        };
      });

      // Remove duplicates by ID
      const uniqueTransactions = platformTransactions.filter(
        (transaction, index, self) =>
          index === self.findIndex((t) => t.id === transaction.id),
      );

      console.log(
        `After deduplication: ${uniqueTransactions.length} unique transactions (was ${platformTransactions.length})`,
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
      if (params?.status && params.status !== 'all') {
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
        
        filteredTransactions = filteredTransactions.filter((transaction: any) => {
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
        });
        console.log(
          `Filtered by amount (${operator} ${params.amount}): ${filteredTransactions.length} transactions`,
        );
      }

      // Apply currency filter if provided
      if (params?.currency && params.currency !== 'all') {
        filteredTransactions = filteredTransactions.filter(
          (transaction: any) => transaction.currency.toLowerCase() === params.currency.toLowerCase(),
        );
        console.log(
          `Filtered by currency '${params.currency}': ${filteredTransactions.length} transactions`,
        );
      }

      // Apply payment method filter if provided
      if (params?.paymentMethod && params.paymentMethod !== 'all') {
        filteredTransactions = filteredTransactions.filter((transaction: any) => {
          return transaction.payment_method?.type === params.paymentMethod;
        });
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
      customer: payment.customer
        ? {
            id: String(payment.customer),
            email: payment.receipt_email,
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
    const payment = await this.stripe!.paymentIntents.retrieve(id, {
      expand: [
        'payment_method',
        'latest_charge',
        'latest_charge.outcome',
        'latest_charge.refunds',
        'latest_charge.balance_transaction',
        'latest_charge.transfer_data',
        'customer',
      ],
    });

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
      customer: payment.customer
        ? {
            id: String(payment.customer),
            email: payment.receipt_email ?? undefined,
          }
        : undefined,
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

  async getAllTransactionsWithSummary(params: { limit?: number }) {
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
      expand: ['data.customer'], // Only expand customer, not payment_method for charges
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
          expand: ['data.customer'], // Only expand customer, not payment_method for charges
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
        customer: payment.customer
          ? {
              id: String(payment.customer),
              email: payment.receipt_email ?? undefined,
            }
          : undefined,
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
    const platformChargeTransactions = allPlatformCharges.map((charge) => ({
      id: charge.id,
      amount: charge.amount,
      currency: charge.currency,
      status: charge.status === 'succeeded' ? 'succeeded' : charge.status,
      description:
        charge.description ?? charge.metadata?.description ?? undefined,
      customer: charge.customer
        ? {
            id: String(charge.customer),
            email:
              charge.receipt_email ??
              charge.billing_details?.email ??
              undefined,
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

  async getAllPayoutsWithSummary(params: { limit?: number }) {
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
}
