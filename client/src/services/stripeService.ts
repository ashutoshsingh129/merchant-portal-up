// Stripe Transaction Types
export interface StripeTransaction {
    id: string;
    amount: number;
    currency: string;
    status: 'succeeded' | 'pending' | 'failed' | 'canceled' | 'refunded';
    description?: string;
    customer?: {
        id: string;
        email?: string;
        name?: string;
    };
    payment_method?: {
        type: string;
        card?: {
            brand: string;
            last4: string;
        };
    };
    created: number;
    metadata?: Record<string, string>;
    fee?: number;
    net?: number;
    // Additional PaymentIntent fields for richer UI
    amount_received?: number;
    amount_capturable?: number;
    capture_method?: string;
    confirmation_method?: string;
    payment_method_types?: string[];
    // Connect account information
    stripe_account?: string;
    account_email?: string;
    // Charge reference (for charges that were converted to transactions)
    charge_id?: string;
}

export interface StripeTransactionListResponse {
    data: StripeTransaction[];
    has_more: boolean;
    total_count?: number;
}

export interface ApiResponse<T> {
    data: T;
    message: string;
    success: boolean;
}

export class StripeService {
    private baseUrl: string;

    constructor() {
        this.baseUrl =
            process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';
    }

    // Get transactions with pagination and filters
    async getTransactions(params?: {
        limit?: number;
        starting_after?: string;
        ending_before?: string;
        status?: string;
        customer?: string;
    }): Promise<ApiResponse<StripeTransactionListResponse>> {
        try {
            const stripeParams: any = {
                limit: params?.limit || 200,
            };

            if (params?.starting_after)
                stripeParams.starting_after = params.starting_after;
            if (params?.ending_before)
                stripeParams.ending_before = params.ending_before;
            if (params?.status) stripeParams.status = params.status;
            if (params?.customer) stripeParams.customer = params.customer;

            const query = new URLSearchParams({
                limit: String(stripeParams.limit),
                ...(stripeParams.starting_after && {
                    starting_after: stripeParams.starting_after,
                }),
                ...(stripeParams.ending_before && {
                    ending_before: stripeParams.ending_before,
                }),
                ...(stripeParams.status && { status: stripeParams.status }),
                ...(stripeParams.customer && {
                    customer: stripeParams.customer,
                }),
            });

            const res = await fetch(
                `${this.baseUrl}/stripe/transactions?${query.toString()}`
            );
            if (!res.ok) throw new Error('Failed to fetch transactions');
            const body = await res.json();

            return {
                data: {
                    data: body.data,
                    has_more: body.has_more,
                    total_count: body.total_count,
                },
                message: 'Transactions fetched successfully',
                success: true,
            };
        } catch (error) {
            console.error('Error fetching transactions:', error);
            return {
                data: { data: [], has_more: false },
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to fetch transactions',
                success: false,
            };
        }
    }

    // Get a single transaction by ID
    async getTransaction(
        transactionId: string
    ): Promise<ApiResponse<StripeTransaction | null>> {
        try {
            const res = await fetch(
                `${this.baseUrl}/stripe/transactions/${transactionId}`
            );
            if (!res.ok) throw new Error('Failed to fetch transaction');
            const transaction = await res.json();

            return {
                data: transaction,
                message: 'Transaction fetched successfully',
                success: true,
            };
        } catch (error) {
            console.error('Error fetching transaction:', error);
            return {
                data: null,
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to fetch transaction',
                success: false,
            };
        }
    }

    // Get transactions and summary in a single optimized call
    async getTransactionsWithSummary(params?: {
        limit?: number;
        starting_after?: string;
        ending_before?: string;
        status?: string;
        customer?: string;
        created_gte?: number;
        created_lte?: number;
    }): Promise<
        ApiResponse<{
            transactions: StripeTransactionListResponse;
            summary: {
                total: number;
                succeeded: number;
                pending: number;
                failed: number;
                refunded: number;
                disputed: number;
                uncaptured: number;
            };
        }>
    > {
        try {
            const stripeParams: any = {
                limit: params?.limit || 200, // Use higher limit to get more data for summary
            };

            if (params?.starting_after)
                stripeParams.starting_after = params.starting_after;
            if (params?.ending_before)
                stripeParams.ending_before = params.ending_before;
            if (params?.status) stripeParams.status = params.status;
            // Remove customer filtering to show all transactions
            // if (params?.customer && params.customer !== 'all') stripeParams.customer = params.customer;
            if (params?.created_gte)
                stripeParams.created_gte = params.created_gte;
            if (params?.created_lte)
                stripeParams.created_lte = params.created_lte;

            const query = new URLSearchParams({
                limit: String(stripeParams.limit),
                ...(stripeParams.starting_after && {
                    starting_after: stripeParams.starting_after,
                }),
                ...(stripeParams.ending_before && {
                    ending_before: stripeParams.ending_before,
                }),
                ...(stripeParams.status && { status: stripeParams.status }),
                ...(stripeParams.customer && {
                    customer: stripeParams.customer,
                }),
            });

            const res = await fetch(
                `${this.baseUrl}/stripe/transactions-with-summary?${query.toString()}`
            );
            if (!res.ok)
                throw new Error('Failed to fetch transactions with summary');
            const body = await res.json();

            return {
                data: {
                    transactions: body.transactions,
                    summary: body.summary,
                },
                message: 'Transactions and summary fetched successfully',
                success: true,
            };
        } catch (error) {
            console.error('Error fetching transactions with summary:', error);
            return {
                data: {
                    transactions: { data: [], has_more: false },
                    summary: {
                        total: 0,
                        succeeded: 0,
                        pending: 0,
                        failed: 0,
                        refunded: 0,
                        disputed: 0,
                        uncaptured: 0,
                    },
                },
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to fetch transactions with summary',
                success: false,
            };
        }
    }

    // Format amount for display
    formatAmount(amount: number, currency: string): string {
        const formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase(),
        });
        return formatter.format(amount / 100);
    }

    // Format date for display
    formatDate(timestamp: number): string {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    }

    // Get status color for UI
    getStatusColor(status: string): string {
        switch (status) {
            case 'succeeded':
                return '#10b981';
            case 'pending':
                return '#f59e0b';
            case 'failed':
                return '#ef4444';
            case 'refunded':
                return '#6b7280';
            case 'canceled':
                return '#ef4444';
            default:
                return '#6b7280';
        }
    }

    // Get ALL transactions from ALL accounts (platform + Connect)
    async getAllTransactionsWithSummary(params?: { limit?: number }): Promise<
        ApiResponse<{
            transactions: StripeTransactionListResponse;
            summary: {
                total: number;
                succeeded: number;
                pending: number;
                failed: number;
                refunded: number;
                disputed: number;
                uncaptured: number;
            };
        }>
    > {
        try {
            const stripeParams: any = {
                limit: params?.limit || 200,
            };

            const query = new URLSearchParams({
                limit: String(stripeParams.limit),
            });

            const res = await fetch(
                `${this.baseUrl}/stripe/all-transactions?${query.toString()}`
            );
            if (!res.ok)
                throw new Error(
                    'Failed to fetch all transactions with summary'
                );
            const body = await res.json();

            return {
                data: {
                    transactions: body.transactions,
                    summary: body.summary,
                },
                message: 'All transactions and summary fetched successfully',
                success: true,
            };
        } catch (error) {
            console.error(
                'Error fetching all transactions with summary:',
                error
            );
            return {
                data: {
                    transactions: { data: [], has_more: false },
                    summary: {
                        total: 0,
                        succeeded: 0,
                        pending: 0,
                        failed: 0,
                        refunded: 0,
                        disputed: 0,
                        uncaptured: 0,
                    },
                },
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to fetch all transactions with summary',
                success: false,
            };
        }
    }
}

// Export singleton instance
export const stripeService = new StripeService();
