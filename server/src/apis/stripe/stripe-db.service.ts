import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
   * Get combined transactions (payment intents and charges) with pagination
   */
  async getCombinedTransactions(
    userId: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    transactions: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    // Get payment intents and charges separately
    const [paymentIntents, charges] = await Promise.all([
      this.paymentIntentRepository.find({
        where: { userId },
        order: { stripeCreatedAt: 'DESC' },
      }),
      this.chargeRepository.find({
        where: { userId },
        order: { stripeCreatedAt: 'DESC' },
      }),
    ]);

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

    // Add payment intents (avoid duplicates if charge exists)
    const chargePaymentIntentIds = new Set(
      charges.map((c) => c.paymentIntentId).filter((id) => id !== null),
    );

    for (const pi of paymentIntents) {
      // Skip if we already have the charge for this payment intent
      if (!chargePaymentIntentIds.has(pi.stripeId)) {
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
