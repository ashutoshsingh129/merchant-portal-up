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
      limit: params?.limit ?? 10,
      starting_after: params?.starting_after,
      ending_before: params?.ending_before,
      customer: params?.customer,
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
}


