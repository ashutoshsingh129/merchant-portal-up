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
        id?: string;
        object?: string;
        allow_redisplay?: string;
        created?: number;
        customer?: string;
        livemode?: boolean;
        metadata?: Record<string, string>;
        type: string;
        card?: {
            brand: string;
            last4: string;
            exp_month?: number;
            exp_year?: number;
            funding?: string;
        };
        us_bank_account?: {
            account_holder_type?: string;
            account_type?: string;
            bank_name?: string;
            financial_connections_account?: string | null;
            fingerprint?: string;
            last4?: string;
            networks?: {
                preferred?: string;
                supported?: string[];
            };
            routing_number?: string;
            status_details?: Record<string, any>;
        };
        billing_details?: {
            name?: string;
            email?: string;
            phone?: string;
            address?: {
                line1?: string;
                line2?: string;
                city?: string;
                state?: string;
                postal_code?: string;
                country?: string;
            };
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

    // NEW FIELDS based on ChatGPT recommendations
    // Decline reason and failure details
    decline_reason?: string;
    failure_message?: string;
    risk_level?: string;

    // Refund information
    refunded_amount?: number;
    refunded_date?: number;
    refund_count?: number;
    refunds?: Array<{
        id: string;
        amount: number;
        created: number;
        reason?: string;
        status: string;
    }>;

    // Settlement and transfer information
    settlement_merchant?: string;
    transferred_to?: string;
    transfer_group?: string;

    // Terminal information
    terminal_location?: string;
    terminal_reader?: string;

    // Balance transaction details
    balance_transaction_id?: string;
    net_amount?: number;
    fee_details?: any;
    stripe_fee?: number;
    payment_reference?: string;

    // Full PaymentIntent fields matching Stripe API structure
    object?: string;
    amount_details?: {
        tip?: Record<string, any>;
    };
    application?: string | null;
    application_fee_amount?: number | null;
    automatic_payment_methods?: any | null;
    canceled_at?: number | null;
    cancellation_reason?: string | null;
    client_secret?: string;
    excluded_payment_method_types?: string[] | null;
    last_payment_error?: any | null;
    livemode?: boolean;
    next_action?: any | null;
    on_behalf_of?: string | null;
    payment_method_configuration_details?: any | null;
    payment_method_options?: {
        us_bank_account?: {
            mandate_options?: Record<string, any>;
            verification_method?: string;
        };
        [key: string]: any;
    };
    processing?: any | null;
    receipt_email?: string | null;
    review?: string | null;
    setup_future_usage?: string | null;
    shipping?: any | null;
    source?: string | null;
    statement_descriptor?: string;
    statement_descriptor_suffix?: string | null;
    transfer_data?: any | null;
    transfer_group?: string | null;
    latest_charge_id?: string;
}

// Stripe Payout Types
export interface StripePayout {
    id: string;
    amount: number;
    currency: string;
    status: 'paid' | 'pending' | 'in_transit' | 'canceled' | 'failed';
    arrival_date: number;
    created: number;
    description?: string;
    destination: string;
    failure_code?: string;
    failure_message?: string;
    method: 'standard' | 'instant';
    source_type: 'card' | 'bank_account';
    statement_descriptor?: string;
    type: 'bank_account' | 'card';
    metadata?: Record<string, string>;
    // Connect account information
    stripe_account?: string;
    account_email?: string;
}

// Stripe Customer Types
export interface StripeCustomer {
    id: string;
    object: string;
    address?: {
        city: string | null;
        country: string | null;
        line1: string | null;
        line2: string | null;
        postal_code: string | null;
        state: string | null;
    } | null;
    balance: number;
    created: number;
    currency?: string | null;
    default_source?: string | null;
    delinquent: boolean;
    description?: string | null;
    discount?: any | null;
    email?: string | null;
    invoice_prefix?: string | null;
    invoice_settings?: {
        custom_fields?: any | null;
        default_payment_method?: string | null;
        footer?: string | null;
        rendering_options?: any | null;
    } | null;
    livemode: boolean;
    metadata: Record<string, string>;
    name?: string | null;
    next_invoice_sequence: number;
    phone?: string | null;
    preferred_locales: string[];
    shipping?: {
        address?: {
            city: string | null;
            country: string | null;
            line1: string | null;
            line2: string | null;
            postal_code: string | null;
            state: string | null;
        } | null;
        name?: string | null;
        phone?: string | null;
    } | null;
    tax_exempt: string;
    test_clock?: any | null;
}

export interface StripeTransactionListResponse {
    data: StripeTransaction[];
    has_more: boolean;
    total_count?: number;
}

export interface StripePayoutListResponse {
    data: StripePayout[];
    has_more: boolean;
    total_count?: number;
}

export interface StripeCustomerListResponse {
    data: StripeCustomer[];
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

    // Format refund date for display
    formatRefundDate(timestamp: number): string {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
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

    // Get payouts with pagination and filters
    async getPayouts(params?: {
        limit?: number;
        starting_after?: string;
        ending_before?: string;
    }): Promise<ApiResponse<StripePayoutListResponse>> {
        try {
            const stripeParams: any = {
                limit: params?.limit || 200,
            };

            if (params?.starting_after)
                stripeParams.starting_after = params.starting_after;
            if (params?.ending_before)
                stripeParams.ending_before = params.ending_before;

            const query = new URLSearchParams({
                limit: String(stripeParams.limit),
                ...(stripeParams.starting_after && {
                    starting_after: stripeParams.starting_after,
                }),
                ...(stripeParams.ending_before && {
                    ending_before: stripeParams.ending_before,
                }),
            });

            const res = await fetch(
                `${this.baseUrl}/stripe/payouts?${query.toString()}`
            );
            if (!res.ok) throw new Error('Failed to fetch payouts');
            const body = await res.json();

            return {
                data: {
                    data: body.data,
                    has_more: body.has_more,
                    total_count: body.total_count,
                },
                message: 'Payouts fetched successfully',
                success: true,
            };
        } catch (error) {
            console.error('Error fetching payouts:', error);
            return {
                data: { data: [], has_more: false },
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to fetch payouts',
                success: false,
            };
        }
    }

    // Get a single payout by ID
    async getPayout(
        payoutId: string
    ): Promise<ApiResponse<StripePayout | null>> {
        try {
            const res = await fetch(
                `${this.baseUrl}/stripe/payouts/${payoutId}`
            );
            if (!res.ok) throw new Error('Failed to fetch payout');
            const payout = await res.json();

            return {
                data: payout,
                message: 'Payout fetched successfully',
                success: true,
            };
        } catch (error) {
            console.error('Error fetching payout:', error);
            return {
                data: null,
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to fetch payout',
                success: false,
            };
        }
    }

    // OPTIMIZED METHODS FOR FAST LOADING

    // Get transactions with fast loading and pagination
    async getTransactionsFast(params?: {
        limit?: number;
        page?: number;
        account?: string;
    }): Promise<ApiResponse<StripeTransactionListResponse>> {
        try {
            const query = new URLSearchParams();
            if (params?.limit) query.append('limit', String(params.limit));
            if (params?.page) query.append('page', String(params.page));
            if (params?.account) query.append('account', params.account);

            const res = await fetch(
                `${this.baseUrl}/stripe/transactions-fast?${query.toString()}`
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
            console.error('Error fetching fast transactions:', error);
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

    // Get payouts with fast loading and pagination
    async getPayoutsFast(params?: {
        limit?: number;
        page?: number;
        account?: string;
    }): Promise<ApiResponse<StripePayoutListResponse>> {
        try {
            const query = new URLSearchParams();
            if (params?.limit) query.append('limit', String(params.limit));
            if (params?.page) query.append('page', String(params.page));
            if (params?.account) query.append('account', params.account);

            const res = await fetch(
                `${this.baseUrl}/stripe/payouts-fast?${query.toString()}`
            );
            if (!res.ok) throw new Error('Failed to fetch payouts');
            const body = await res.json();

            return {
                data: {
                    data: body.data,
                    has_more: body.has_more,
                    total_count: body.total_count,
                },
                message: 'Payouts fetched successfully',
                success: true,
            };
        } catch (error) {
            console.error('Error fetching fast payouts:', error);
            return {
                data: { data: [], has_more: false },
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to fetch payouts',
                success: false,
            };
        }
    }

    // Get summary data efficiently
    async getSummaryFast(account?: string): Promise<
        ApiResponse<{
            total: number;
            succeeded: number;
            pending: number;
            failed: number;
            refunded: number;
            disputed: number;
            uncaptured: number;
        }>
    > {
        try {
            const query = new URLSearchParams();
            if (account) query.append('account', account);

            const res = await fetch(
                `${this.baseUrl}/stripe/summary-fast?${query.toString()}`
            );
            if (!res.ok) throw new Error('Failed to fetch summary');
            const body = await res.json();

            return {
                data: body,
                message: 'Summary fetched successfully',
                success: true,
            };
        } catch (error) {
            console.error('Error fetching summary:', error);
            return {
                data: {
                    total: 0,
                    succeeded: 0,
                    pending: 0,
                    failed: 0,
                    refunded: 0,
                    disputed: 0,
                    uncaptured: 0,
                },
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to fetch summary',
                success: false,
            };
        }
    }

    // Get accounts efficiently
    async getAccountsFast(): Promise<
        ApiResponse<{
            accounts: Array<{
                id: string;
                email: string;
                country: string;
                type: string;
                business_type: string;
                charges_enabled: boolean;
                payouts_enabled: boolean;
            }>;
            total: number;
        }>
    > {
        try {
            const res = await fetch(`${this.baseUrl}/stripe/accounts-fast`);
            if (!res.ok) throw new Error('Failed to fetch accounts');
            const body = await res.json();

            return {
                data: body,
                message: 'Accounts fetched successfully',
                success: true,
            };
        } catch (error) {
            console.error('Error fetching accounts:', error);
            return {
                data: { accounts: [], total: 0 },
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to fetch accounts',
                success: false,
            };
        }
    }

    // Clear cache
    async clearCache(
        pattern?: string
    ): Promise<ApiResponse<{ message: string }>> {
        try {
            const res = await fetch(`${this.baseUrl}/stripe/clear-cache`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ pattern }),
            });
            if (!res.ok) throw new Error('Failed to clear cache');
            const body = await res.json();

            return {
                data: body,
                message: 'Cache cleared successfully',
                success: true,
            };
        } catch (error) {
            console.error('Error clearing cache:', error);
            return {
                data: { message: 'Failed to clear cache' },
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to clear cache',
                success: false,
            };
        }
    }

    // Get transactions from ALL accounts (platform + Connect) - optimized
    async getAllTransactionsFast(params?: {
        limit?: number;
        page?: number;
        status?: string;
        statusFilter?: string[]; // Array of raw payment intent statuses
        days?: number;
        amount?: number;
        amountOperator?: string;
        currency?: string;
        paymentMethod?: string;
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
            const query = new URLSearchParams();
            if (params?.limit) query.append('limit', String(params.limit));
            if (params?.page) query.append('page', String(params.page));
            if (params?.status) query.append('status', params.status);
            if (params?.statusFilter && params.statusFilter.length > 0) {
                query.append('statusFilter', params.statusFilter.join(','));
            }
            if (params?.days) query.append('days', String(params.days));
            if (params?.amount !== undefined)
                query.append('amount', String(params.amount));
            if (params?.amountOperator)
                query.append('amountOperator', params.amountOperator);
            if (params?.currency) query.append('currency', params.currency);
            if (params?.paymentMethod)
                query.append('paymentMethod', params.paymentMethod);

            const res = await fetch(
                `${this.baseUrl}/stripe/all-transactions-fast?${query.toString()}`
            );
            if (!res.ok) throw new Error('Failed to fetch all transactions');
            const body = await res.json();

            return {
                data: {
                    transactions: body.transactions,
                    summary: body.summary,
                },
                message: 'All transactions fetched successfully',
                success: true,
            };
        } catch (error) {
            console.error('Error fetching all transactions:', error);
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
                        : 'Failed to fetch all transactions',
                success: false,
            };
        }
    }

    // Get ALL payouts from ALL accounts (platform + Connect) - optimized
    async getAllPayoutsFast(params?: {
        limit?: number;
        page?: number;
        status?: string;
    }): Promise<
        ApiResponse<{
            payouts: StripePayoutListResponse;
            summary: {
                total: number;
                paid: number;
                pending: number;
                in_transit: number;
                canceled: number;
                failed: number;
            };
        }>
    > {
        try {
            const query = new URLSearchParams();
            if (params?.limit) query.append('limit', String(params.limit));
            if (params?.page) query.append('page', String(params.page));
            if (params?.status) query.append('status', params.status);

            const res = await fetch(
                `${this.baseUrl}/stripe/all-payouts-fast?${query.toString()}`
            );
            if (!res.ok) throw new Error('Failed to fetch all payouts');
            const body = await res.json();

            return {
                data: {
                    payouts: body.payouts,
                    summary: body.summary,
                },
                message: 'All payouts fetched successfully',
                success: true,
            };
        } catch (error) {
            console.error('Error fetching all payouts:', error);
            return {
                data: {
                    payouts: { data: [], has_more: false },
                    summary: {
                        total: 0,
                        paid: 0,
                        pending: 0,
                        in_transit: 0,
                        canceled: 0,
                        failed: 0,
                    },
                },
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to fetch all payouts',
                success: false,
            };
        }
    }

    // Get ALL customers from platform account - optimized
    async getAllCustomersFast(params?: {
        limit?: number;
        page?: number;
    }): Promise<
        ApiResponse<{
            customers: StripeCustomerListResponse;
            summary: {
                total: number;
                delinquent: number;
                with_email: number;
                with_phone: number;
                with_balance: number;
            };
        }>
    > {
        try {
            const query = new URLSearchParams();
            if (params?.limit) query.append('limit', String(params.limit));
            if (params?.page) query.append('page', String(params.page));

            const res = await fetch(
                `${this.baseUrl}/stripe/all-customers-fast?${query.toString()}`
            );
            if (!res.ok) throw new Error('Failed to fetch all customers');
            const body = await res.json();

            return {
                data: {
                    customers: body.customers,
                    summary: body.summary,
                },
                message: 'All customers fetched successfully',
                success: true,
            };
        } catch (error) {
            console.error('Error fetching all customers:', error);
            return {
                data: {
                    customers: { data: [], has_more: false },
                    summary: {
                        total: 0,
                        delinquent: 0,
                        with_email: 0,
                        with_phone: 0,
                        with_balance: 0,
                    },
                },
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to fetch all customers',
                success: false,
            };
        }
    }

    // Get volume data for dashboard graphs
    async getVolumeData(params?: {
        days?: number;
        groupBy?: 'hour' | 'day';
        date?: Date;
    }): Promise<
        ApiResponse<{
            data: Array<{
                time: string;
                gross: number;
                net: number;
                count: number;
                newCustomers: number;
            }>;
            totals: {
                gross: number;
                net: number;
                count: number;
                newCustomers: number;
            };
            period: {
                days: number;
                groupBy: 'hour' | 'day';
                startTime: number;
                endTime: number;
            };
        }>
    > {
        try {
            const query = new URLSearchParams();
            if (params?.days) query.append('days', String(params.days));
            if (params?.groupBy) query.append('groupBy', params.groupBy);
            if (params?.date) {
                query.append('date', params.date.toISOString());
            }

            const res = await fetch(
                `${this.baseUrl}/stripe/volume-data?${query.toString()}`
            );
            if (!res.ok) throw new Error('Failed to fetch volume data');
            const body = await res.json();

            return {
                data: body,
                message: 'Volume data fetched successfully',
                success: true,
            };
        } catch (error) {
            console.error('Error fetching volume data:', error);
            return {
                data: {
                    data: [],
                    totals: { gross: 0, net: 0, count: 0, newCustomers: 0 },
                    period: {
                        days: params?.days || 1,
                        groupBy: params?.groupBy || 'hour',
                        startTime: 0,
                        endTime: 0,
                    },
                },
                message:
                    error instanceof Error
                        ? error.message
                        : 'Failed to fetch volume data',
                success: false,
            };
        }
    }
}

// Export singleton instance
export const stripeService = new StripeService();
