import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, In, Like } from 'typeorm';
import { PaymentIntent } from '../../datastore/models/payment-intent.model';
import { Charge } from '../../datastore/models/charge.model';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

@Injectable()
export class StripeDbService {
  constructor(
    @InjectRepository(PaymentIntent)
    private paymentIntentRepository: Repository<PaymentIntent>,
    @InjectRepository(Charge)
    private chargeRepository: Repository<Charge>,
  ) {}

  /**
   * Get paginated payment intents for a user
   */
  async getPaymentIntents(
    userId: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponse<PaymentIntent>> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.paymentIntentRepository.findAndCount({
      where: { userId },
      order: { stripeCreatedAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
    };
  }

  /**
   * Get paginated charges for a user
   */
  async getCharges(
    userId: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedResponse<Charge>> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.chargeRepository.findAndCount({
      where: { userId },
      order: { stripeCreatedAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
    };
  }

  /**
   * Build filter conditions for database queries
   */
  private buildFilterConditions(
    filters: {
      status?: string;
      statusFilter?: string[];
      days?: number;
      dateFilterType?: string;
      dateFilterInput?: string;
      dateFilterInput2?: string;
      amount?: number;
      amountOperator?: string;
      currency?: string;
      paymentMethod?: string;
      customerId?: string;
      email?: string;
      cardBrand?: string;
      declineReason?: string;
      last4Digits?: string;
    },
  ): {
    paymentIntentWhere: any;
    chargeWhere: any;
    dateFilter?: { start?: Date; end?: Date };
  } {
    const paymentIntentWhere: any = {};
    const chargeWhere: any = {};
    let dateFilter: { start?: Date; end?: Date } | undefined;

    // Status filter
    if (filters.statusFilter && filters.statusFilter.length > 0) {
      if (filters.statusFilter.length === 1) {
        paymentIntentWhere.status = filters.statusFilter[0];
        chargeWhere.status = filters.statusFilter[0];
      } else {
        paymentIntentWhere.status = In(filters.statusFilter);
        chargeWhere.status = In(filters.statusFilter);
      }
    } else if (filters.status) {
      paymentIntentWhere.status = filters.status;
      chargeWhere.status = filters.status;
    }

    // Currency filter
    if (filters.currency) {
      paymentIntentWhere.currency = filters.currency;
      chargeWhere.currency = filters.currency;
    }

    // Payment method filter
    if (filters.paymentMethod) {
      paymentIntentWhere.paymentMethodType = filters.paymentMethod;
      chargeWhere.paymentMethodType = filters.paymentMethod;
    }

    // Customer ID filter (use Like for partial matching)
    if (filters.customerId) {
      paymentIntentWhere.customerId = Like(`%${filters.customerId}%`);
      chargeWhere.customerId = Like(`%${filters.customerId}%`);
    }

    // Email filter (use Like for partial matching)
    if (filters.email) {
      paymentIntentWhere.customerEmail = Like(`%${filters.email}%`);
      chargeWhere.customerEmail = Like(`%${filters.email}%`);
    }

    // Date filter
    if (filters.days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filters.days);
      dateFilter = { start: cutoffDate };
    } else if (filters.dateFilterType && filters.dateFilterInput) {
      const filterDate = new Date(filters.dateFilterInput);
      filterDate.setHours(0, 0, 0, 0);
      
      if (filters.dateFilterType === 'equal_to') {
        const filterDateEnd = new Date(filters.dateFilterInput);
        filterDateEnd.setHours(23, 59, 59, 999);
        dateFilter = { start: filterDate, end: filterDateEnd };
      } else if (filters.dateFilterType === 'on_or_after') {
        dateFilter = { start: filterDate };
      } else if (filters.dateFilterType === 'before_or_on') {
        const filterDateEnd = new Date(filters.dateFilterInput);
        filterDateEnd.setHours(23, 59, 59, 999);
        dateFilter = { end: filterDateEnd };
      } else if (filters.dateFilterType === 'between' && filters.dateFilterInput2) {
        const filterDate2 = new Date(filters.dateFilterInput2);
        filterDate2.setHours(23, 59, 59, 999);
        dateFilter = { start: filterDate, end: filterDate2 };
      }
    }

    return { paymentIntentWhere, chargeWhere, dateFilter };
  }

  /**
   * Apply filters to transactions array
   */
  private applyClientSideFilters(
    transactions: any[],
    filters: {
      amount?: number;
      amountOperator?: string;
      cardBrand?: string;
      declineReason?: string;
      last4Digits?: string;
    },
  ): any[] {
    let filtered = transactions;

    // Amount filter
    if (filters.amount !== undefined && filters.amountOperator) {
      const amountInCents = Math.round(filters.amount * 100);
      filtered = filtered.filter((t) => {
        switch (filters.amountOperator) {
          case 'eq':
            return t.amount === amountInCents;
          case 'gt':
            return t.amount > amountInCents;
          case 'lt':
            return t.amount < amountInCents;
          case 'gte':
            return t.amount >= amountInCents;
          case 'lte':
            return t.amount <= amountInCents;
          default:
            return true;
        }
      });
    }

    // Card brand filter (from payment_method_details or stripeData)
    if (filters.cardBrand) {
      filtered = filtered.filter((t) => {
        const brand = t.payment_method_details?.card?.brand || 
                     t.stripeData?.payment_method?.card?.brand ||
                     t.stripeData?.payment_method_details?.card?.brand;
        return brand?.toLowerCase() === filters.cardBrand?.toLowerCase();
      });
    }

    // Decline reason filter
    if (filters.declineReason) {
      filtered = filtered.filter((t) => {
        const reason = t.stripeData?.outcome?.reason || 
                      t.stripeData?.latest_charge?.outcome?.reason ||
                      t.decline_reason;
        return reason?.toLowerCase().includes(filters.declineReason?.toLowerCase());
      });
    }

    // Last 4 digits filter
    if (filters.last4Digits) {
      filtered = filtered.filter((t) => {
        const last4 = t.payment_method_details?.card?.last4 || 
                     t.stripeData?.payment_method?.card?.last4 ||
                     t.stripeData?.payment_method_details?.card?.last4;
        return last4 === filters.last4Digits;
      });
    }

    return filtered;
  }

  /**
   * Get combined transactions (payment intents and charges) with pagination and filters
   */
  async getCombinedTransactions(
    userId: number,
    page: number = 1,
    limit: number = 10,
    filters?: {
      status?: string;
      statusFilter?: string[];
      days?: number;
      dateFilterType?: string;
      dateFilterInput?: string;
      dateFilterInput2?: string;
      amount?: number;
      amountOperator?: string;
      currency?: string;
      paymentMethod?: string;
      customerId?: string;
      email?: string;
      cardBrand?: string;
      declineReason?: string;
      last4Digits?: string;
    },
  ): Promise<{
    transactions: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    // Build filter conditions
    const { paymentIntentWhere, chargeWhere, dateFilter } = filters
      ? this.buildFilterConditions(filters)
      : { paymentIntentWhere: {}, chargeWhere: {}, dateFilter: undefined };

    // Build where clauses with date filter
    const paymentIntentWhereClause: any = { userId, ...paymentIntentWhere };
    const chargeWhereClause: any = { userId, ...chargeWhere };
    
    // Apply date filter using TypeORM operators
    if (dateFilter) {
      if (dateFilter.start && dateFilter.end) {
        // Both start and end - use Between or combine operators
        paymentIntentWhereClause.stripeCreatedAt = MoreThanOrEqual(dateFilter.start);
        chargeWhereClause.stripeCreatedAt = MoreThanOrEqual(dateFilter.start);
        // We'll need to filter end date in memory or use a query builder
      } else if (dateFilter.start) {
        paymentIntentWhereClause.stripeCreatedAt = MoreThanOrEqual(dateFilter.start);
        chargeWhereClause.stripeCreatedAt = MoreThanOrEqual(dateFilter.start);
      } else if (dateFilter.end) {
        paymentIntentWhereClause.stripeCreatedAt = LessThanOrEqual(dateFilter.end);
        chargeWhereClause.stripeCreatedAt = LessThanOrEqual(dateFilter.end);
      }
    }

    // Get payment intents and charges separately
    let [paymentIntents, charges] = await Promise.all([
      this.paymentIntentRepository.find({
        where: paymentIntentWhereClause,
        order: { stripeCreatedAt: 'DESC' },
      }),
      this.chargeRepository.find({
        where: chargeWhereClause,
        order: { stripeCreatedAt: 'DESC' },
      }),
    ]);

    // Apply end date filter in memory if both start and end are present
    if (dateFilter?.start && dateFilter?.end) {
      paymentIntents = paymentIntents.filter(
        (pi) => pi.stripeCreatedAt >= dateFilter.start! && pi.stripeCreatedAt <= dateFilter.end!,
      );
      charges = charges.filter(
        (c) => c.stripeCreatedAt >= dateFilter.start! && c.stripeCreatedAt <= dateFilter.end!,
      );
    }

    // Combine and transform to match the existing transaction format
    let transactions = [];

    // Add charges
    for (const charge of charges) {
      transactions.push({
        id: charge.stripeId,
        object: 'charge',
        amount: charge.amount,
        currency: charge.currency,
        status:
          charge.status === 'succeeded'
            ? 'succeeded'
            : charge.status === 'failed'
              ? 'failed'
              : charge.status,
        customer: {
          id: charge.customerId,
          email: charge.customerEmail,
        },
        description: charge.description,
        created: Math.floor(charge.stripeCreatedAt.getTime() / 1000),
        payment_method_details: charge.stripeData?.payment_method_details || {},
        amount_refunded: charge.amountRefunded,
        refunded: charge.refunded,
        payment_intent: charge.paymentIntentId,
        metadata: charge.stripeData?.metadata || {},
        stripeData: charge.stripeData,
      });
    }

    // Add payment intents (avoid duplicates if charge exists)
    // 
    // DEDUPLICATION LOGIC:
    // A duplicate exists when: charges.payment_intent_id = payment_intents.stripe_id
    // 
    // Stripe API Structure:
    // - Charge object: { "id": "ch_xxx", "payment_intent": "pi_xxx" }
    // - Payment Intent object: { "id": "pi_xxx", "latest_charge": "ch_xxx" }
    // 
    // Relationship:
    // - Charge.payment_intent → Payment Intent.id (stripe_id)
    // - Payment Intent.latest_charge → Charge.id (stripe_id)
    // 
    // We prioritize Charges over Payment Intents (charges represent completed transactions)
    // If a charge exists for a payment intent, we skip the payment intent (show only the charge)
    
    // Build set of payment intent IDs from charges
    // This identifies which payment intents have corresponding charges (duplicates)
    const chargePaymentIntentIds = new Set(
      charges
        .map((c) => c.paymentIntentId)
        .filter((id) => id !== null && id !== undefined && id !== '')
        .map((id) => String(id).trim()), // Normalize to string and trim
    );

    for (const pi of paymentIntents) {
      // Skip if we already have the charge for this payment intent
      // Check: charges.payment_intent_id = payment_intents.stripe_id
      const piId = String(pi.stripeId).trim();
      if (!chargePaymentIntentIds.has(piId)) {
        const latestCharge = pi.stripeData?.latest_charge;
        const chargeAmount =
          typeof latestCharge === 'object' && latestCharge
            ? latestCharge.amount
            : pi.amount;

        transactions.push({
          id: pi.stripeId,
          object: 'payment_intent',
          amount: pi.amount,
          currency: pi.currency,
          status: pi.status,
          customer: {
            id: pi.customerId,
            email: pi.customerEmail,
          },
          description: pi.description,
          created: Math.floor(pi.stripeCreatedAt.getTime() / 1000),
          payment_method_details: pi.stripeData?.payment_method || {},
          amount_refunded: 0,
          refunded: false,
          payment_intent: pi.stripeId,
          metadata: pi.stripeData?.metadata || {},
          stripeData: pi.stripeData,
        });
      }
    }

    // Sort by created date (most recent first)
    transactions.sort((a, b) => b.created - a.created);

    // Apply client-side filters (amount, cardBrand, declineReason, last4Digits)
    if (filters) {
      transactions = this.applyClientSideFilters(transactions, {
        amount: filters.amount,
        amountOperator: filters.amountOperator,
        cardBrand: filters.cardBrand,
        declineReason: filters.declineReason,
        last4Digits: filters.last4Digits,
      });
    }

    // Apply pagination
    const total = transactions.length;
    const skip = (page - 1) * limit;
    const paginatedTransactions = transactions.slice(skip, skip + limit);

    return {
      transactions: paginatedTransactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
    };
  }

  /**
   * Get summary/statistics from database with filters applied
   */
  async getSummary(
    userId: number,
    filters?: {
      status?: string;
      statusFilter?: string[];
      days?: number;
      dateFilterType?: string;
      dateFilterInput?: string;
      dateFilterInput2?: string;
      amount?: number;
      amountOperator?: string;
      currency?: string;
      paymentMethod?: string;
      customerId?: string;
      email?: string;
      cardBrand?: string;
      declineReason?: string;
      last4Digits?: string;
    },
  ): Promise<{
    total: number;
    succeeded: number;
    pending: number;
    failed: number;
    refunded: number;
    disputed: number;
    uncaptured: number;
  }> {
    // Build filter conditions
    const { paymentIntentWhere, chargeWhere, dateFilter } = filters
      ? this.buildFilterConditions(filters)
      : { paymentIntentWhere: {}, chargeWhere: {}, dateFilter: undefined };

    // Build where clauses with date filter
    const paymentIntentWhereClause: any = { userId, ...paymentIntentWhere };
    const chargeWhereClause: any = { userId, ...chargeWhere };
    
    // Apply date filter using TypeORM operators
    if (dateFilter) {
      if (dateFilter.start && dateFilter.end) {
        paymentIntentWhereClause.stripeCreatedAt = MoreThanOrEqual(dateFilter.start);
        chargeWhereClause.stripeCreatedAt = MoreThanOrEqual(dateFilter.start);
      } else if (dateFilter.start) {
        paymentIntentWhereClause.stripeCreatedAt = MoreThanOrEqual(dateFilter.start);
        chargeWhereClause.stripeCreatedAt = MoreThanOrEqual(dateFilter.start);
      } else if (dateFilter.end) {
        paymentIntentWhereClause.stripeCreatedAt = LessThanOrEqual(dateFilter.end);
        chargeWhereClause.stripeCreatedAt = LessThanOrEqual(dateFilter.end);
      }
    }

    // Get all payment intents and charges (no pagination for summary)
    let [paymentIntents, charges] = await Promise.all([
      this.paymentIntentRepository.find({
        where: paymentIntentWhereClause,
        order: { stripeCreatedAt: 'DESC' },
      }),
      this.chargeRepository.find({
        where: chargeWhereClause,
        order: { stripeCreatedAt: 'DESC' },
      }),
    ]);

    // Apply end date filter in memory if both start and end are present
    if (dateFilter?.start && dateFilter?.end) {
      paymentIntents = paymentIntents.filter(
        (pi) => pi.stripeCreatedAt >= dateFilter.start! && pi.stripeCreatedAt <= dateFilter.end!,
      );
      charges = charges.filter(
        (c) => c.stripeCreatedAt >= dateFilter.start! && c.stripeCreatedAt <= dateFilter.end!,
      );
    }

    // Combine and transform to match the existing transaction format
    const transactions = [];

    // Add charges
    for (const charge of charges) {
      transactions.push({
        id: charge.stripeId,
        object: 'charge',
        amount: charge.amount,
        currency: charge.currency,
        status:
          charge.status === 'succeeded'
            ? 'succeeded'
            : charge.status === 'failed'
              ? 'failed'
              : charge.status,
        customer: {
          id: charge.customerId,
          email: charge.customerEmail,
        },
        description: charge.description,
        created: Math.floor(charge.stripeCreatedAt.getTime() / 1000),
        payment_method_details: charge.stripeData?.payment_method_details || {},
        amount_refunded: charge.amountRefunded,
        refunded: charge.refunded,
        payment_intent: charge.paymentIntentId,
        metadata: charge.stripeData?.metadata || {},
        stripeData: charge.stripeData,
      });
    }

    // Build set of payment intent IDs from charges for deduplication
    const chargePaymentIntentIds = new Set(
      charges
        .map((c) => c.paymentIntentId)
        .filter((id) => id !== null && id !== undefined && id !== '')
        .map((id) => String(id).trim()),
    );

    // Add payment intents (avoid duplicates if charge exists)
    for (const pi of paymentIntents) {
      const piId = String(pi.stripeId).trim();
      if (!chargePaymentIntentIds.has(piId)) {
        transactions.push({
          id: pi.stripeId,
          object: 'payment_intent',
          amount: pi.amount,
          currency: pi.currency,
          status: pi.status,
          customer: {
            id: pi.customerId,
            email: pi.customerEmail,
          },
          description: pi.description,
          created: Math.floor(pi.stripeCreatedAt.getTime() / 1000),
          payment_method_details: pi.stripeData?.payment_method || {},
          amount_refunded: 0,
          refunded: false,
          payment_intent: pi.stripeId,
          metadata: pi.stripeData?.metadata || {},
          stripeData: pi.stripeData,
        });
      }
    }

    // Apply client-side filters (amount, cardBrand, declineReason, last4Digits)
    let filteredTransactions = transactions;
    if (filters) {
      filteredTransactions = this.applyClientSideFilters(transactions, {
        amount: filters.amount,
        amountOperator: filters.amountOperator,
        cardBrand: filters.cardBrand,
        declineReason: filters.declineReason,
        last4Digits: filters.last4Digits,
      });
    }

    // Calculate summary statistics
    const summary = {
      total: filteredTransactions.length,
      succeeded: filteredTransactions.filter((t) => t.status === 'succeeded').length,
      pending: filteredTransactions.filter((t) => t.status === 'pending' || t.status === 'processing').length,
      failed: filteredTransactions.filter((t) => t.status === 'failed' || t.status === 'canceled').length,
      refunded: filteredTransactions.filter((t) => t.refunded || t.status === 'refunded').length,
      disputed: filteredTransactions.filter((t) => {
        // Check for dispute indicators in stripeData
        return t.stripeData?.dispute || 
               t.stripeData?.latest_charge?.dispute ||
               t.stripeData?.charges?.data?.some((c: any) => c.dispute);
      }).length,
      uncaptured: filteredTransactions.filter((t) => 
        t.status === 'requires_capture' || 
        (t.status === 'succeeded' && t.amount_capturable && t.amount_capturable > 0)
      ).length,
    };

    return summary;
  }

  /**
   * Get sync status and record counts
   */
  async getSyncStatus(userId: number): Promise<{
    paymentIntentsCount: number;
    chargesCount: number;
    totalTransactions: number;
    oldestRecord: Date | null;
    newestRecord: Date | null;
  }> {
    const [
      paymentIntentCount,
      chargeCount,
      oldestPi,
      newestPi,
      oldestCharge,
      newestCharge,
    ] = await Promise.all([
      this.paymentIntentRepository.count({ where: { userId } }),
      this.chargeRepository.count({ where: { userId } }),
      this.paymentIntentRepository.findOne({
        where: { userId },
        order: { stripeCreatedAt: 'ASC' },
      }),
      this.paymentIntentRepository.findOne({
        where: { userId },
        order: { stripeCreatedAt: 'DESC' },
      }),
      this.chargeRepository.findOne({
        where: { userId },
        order: { stripeCreatedAt: 'ASC' },
      }),
      this.chargeRepository.findOne({
        where: { userId },
        order: { stripeCreatedAt: 'DESC' },
      }),
    ]);

    const allDates = [
      oldestPi?.stripeCreatedAt,
      newestPi?.stripeCreatedAt,
      oldestCharge?.stripeCreatedAt,
      newestCharge?.stripeCreatedAt,
    ].filter((date): date is Date => date !== undefined && date !== null);

    return {
      paymentIntentsCount: paymentIntentCount,
      chargesCount: chargeCount,
      totalTransactions: paymentIntentCount + chargeCount,
      oldestRecord:
        allDates.length > 0
          ? new Date(Math.min(...allDates.map((d) => d.getTime())))
          : null,
      newestRecord:
        allDates.length > 0
          ? new Date(Math.max(...allDates.map((d) => d.getTime())))
          : null,
    };
  }

  /**
   * Get a single transaction by ID
   */
  async getTransactionById(
    userId: number,
    transactionId: string,
  ): Promise<any> {
    // Try to find as charge first
    let charge = await this.chargeRepository.findOne({
      where: { stripeId: transactionId, userId },
    });

    if (charge) {
      return {
        id: charge.stripeId,
        object: 'charge',
        amount: charge.amount,
        currency: charge.currency,
        status: charge.status,
        customer: {
          id: charge.customerId,
          email: charge.customerEmail,
        },
        description: charge.description,
        created: Math.floor(charge.stripeCreatedAt.getTime() / 1000),
        payment_method_details: charge.stripeData?.payment_method_details || {},
        amount_refunded: charge.amountRefunded,
        refunded: charge.refunded,
        payment_intent: charge.paymentIntentId,
        metadata: charge.stripeData?.metadata || {},
        stripeData: charge.stripeData,
      };
    }

    // Try to find as payment intent
    const paymentIntent = await this.paymentIntentRepository.findOne({
      where: { stripeId: transactionId, userId },
    });

    if (paymentIntent) {
      return {
        id: paymentIntent.stripeId,
        object: 'payment_intent',
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        customer: {
          id: paymentIntent.customerId,
          email: paymentIntent.customerEmail,
        },
        description: paymentIntent.description,
        created: Math.floor(paymentIntent.stripeCreatedAt.getTime() / 1000),
        payment_method_details: paymentIntent.stripeData?.payment_method || {},
        amount_refunded: 0,
        refunded: false,
        payment_intent: paymentIntent.stripeId,
        metadata: paymentIntent.stripeData?.metadata || {},
        stripeData: paymentIntent.stripeData,
      };
    }

    return null;
  }
}
