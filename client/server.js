const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Stripe
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Routes
app.get('/api/stripe/transactions', async (req, res) => {
    try {
        const { limit = 200, starting_after, ending_before, status, customer } = req.query;
        
        const params = {
            limit: parseInt(limit),
            ...(starting_after && { starting_after }),
            ...(ending_before && { ending_before }),
            ...(status && { status }),
            // Remove customer filtering to show all transactions from all accounts
            // ...(customer && { customer }),
        };

        const payments = await stripe.paymentIntents.list({
            ...params,
            expand: ['data.payment_method', 'data.customer']
        });
        
        // Transform Stripe data to match our interface
        const transactions = payments.data.map(payment => ({
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            description: payment.description,
            customer: payment.customer ? {
                id: payment.customer,
                email: payment.receipt_email,
            } : undefined,
            payment_method: payment.payment_method ? {
                type: payment.payment_method.type,
                card: payment.payment_method.card ? {
                    brand: payment.payment_method.card.brand,
                    last4: payment.payment_method.card.last4,
                } : undefined,
            } : undefined,
            created: payment.created,
            metadata: payment.metadata,
            fee: payment.application_fee_amount,
            net: payment.amount - (payment.application_fee_amount || 0),
        }));

        res.json({
            data: transactions,
            has_more: payments.has_more,
            total_count: transactions.length,
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/stripe/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const payment = await stripe.paymentIntents.retrieve(id);
        
        const transaction = {
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            description: payment.description,
            customer: payment.customer ? {
                id: payment.customer,
                email: payment.receipt_email,
            } : undefined,
            payment_method: payment.payment_method ? {
                type: payment.payment_method.type,
                card: payment.payment_method.card ? {
                    brand: payment.payment_method.card.brand,
                    last4: payment.payment_method.card.last4,
                } : undefined,
            } : undefined,
            created: payment.created,
            metadata: payment.metadata,
            fee: payment.application_fee_amount,
            net: payment.amount - (payment.application_fee_amount || 0),
        };

        res.json(transaction);
    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/stripe/transactions/summary', async (req, res) => {
    try {
        const payments = await stripe.paymentIntents.list({ limit: 100 });
        
        const summary = payments.data.reduce((acc, payment) => {
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
        }, {
            total: 0,
            succeeded: 0,
            pending: 0,
            failed: 0,
            refunded: 0,
            disputed: 0,
            uncaptured: 0,
        });

        res.json(summary);
    } catch (error) {
        console.error('Error fetching transaction summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Combined: transactions + summary in one call
app.get('/api/stripe/transactions-with-summary', async (req, res) => {
    try {
        const { limit = 200, starting_after, ending_before, status, customer, created_gte, created_lte } = req.query;

        const params = {
            limit: parseInt(limit),
            ...(starting_after && { starting_after }),
            ...(ending_before && { ending_before }),
            ...(status && { status }),
            // Remove customer filtering to show all transactions from all accounts
            // ...(customer && customer !== 'all' && { customer }),
            // Add date range filtering
            ...(created_gte && { created: { gte: parseInt(created_gte) } }),
            ...(created_lte && { created: { lte: parseInt(created_lte) } }),
        };

        // Try to fetch from Connect accounts if available
        const payments = await stripe.paymentIntents.list({
            ...params,
            expand: ['data.payment_method', 'data.customer']
        });

        console.log(`Fetched ${payments.data.length} payment intents from Stripe`);
        console.log(`Total available: ${payments.has_more ? 'More available' : 'All fetched'}`);
        console.log(`First few payment IDs:`, payments.data.slice(0, 3).map(p => p.id));

        const transactions = payments.data.map(payment => ({
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            description: payment.description,
            customer: payment.customer ? {
                id: payment.customer,
                email: payment.receipt_email,
            } : undefined,
            payment_method: payment.payment_method ? {
                type: payment.payment_method.type,
                card: payment.payment_method.card ? {
                    brand: payment.payment_method.card.brand,
                    last4: payment.payment_method.card.last4,
                } : undefined,
            } : undefined,
            created: payment.created,
            metadata: payment.metadata,
            fee: payment.application_fee_amount,
            net: payment.amount - (payment.application_fee_amount || 0),
            amount_received: payment.amount_received,
            amount_capturable: payment.amount_capturable,
            capture_method: payment.capture_method,
            confirmation_method: payment.confirmation_method,
            payment_method_types: payment.payment_method_types,
        }));

        const summary = payments.data.reduce((acc, payment) => {
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

        res.json({
            transactions: {
                data: transactions,
                has_more: payments.has_more,
                total_count: transactions.length,
            },
            summary,
        });
    } catch (error) {
        console.error('Error fetching transactions with summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add endpoint to check Connect accounts
app.get('/api/stripe/accounts', async (req, res) => {
    try {
        const accounts = await stripe.accounts.list({ limit: 100 });
        console.log(`Found ${accounts.data.length} connected accounts`);
        
        res.json({
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
        });
    } catch (error) {
        console.error('Error fetching accounts:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add endpoint to fetch transactions from specific Connect account
app.get('/api/stripe/transactions/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { limit = 200 } = req.query;
        
        console.log(`Fetching transactions for Connect account: ${accountId}`);
        
        const payments = await stripe.paymentIntents.list({
            limit: parseInt(limit),
            expand: ['data.payment_method', 'data.customer']
        }, {
            stripeAccount: accountId
        });
        
        console.log(`Fetched ${payments.data.length} payment intents from Connect account ${accountId}`);
        
        const transactions = payments.data.map(payment => ({
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            description: payment.description,
            customer: payment.customer ? {
                id: payment.customer,
                email: payment.receipt_email,
            } : undefined,
            payment_method: payment.payment_method ? {
                type: payment.payment_method.type,
                card: payment.payment_method.card ? {
                    brand: payment.payment_method.card.brand,
                    last4: payment.payment_method.card.last4,
                } : undefined,
            } : undefined,
            created: payment.created,
            metadata: payment.metadata,
            fee: payment.application_fee_amount,
            net: payment.amount - (payment.application_fee_amount || 0),
            amount_received: payment.amount_received,
            amount_capturable: payment.amount_capturable,
            capture_method: payment.capture_method,
            confirmation_method: payment.confirmation_method,
            payment_method_types: payment.payment_method_types,
            stripe_account: accountId,
        }));

        res.json({
            data: transactions,
            has_more: payments.has_more,
            total_count: transactions.length,
            account_id: accountId
        });
    } catch (error) {
        console.error('Error fetching Connect account transactions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add comprehensive endpoint to fetch ALL transactions from ALL accounts
app.get('/api/stripe/all-transactions', async (req, res) => {
    try {
        const { limit = 200 } = req.query;
        let allTransactions = [];
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
        
        // First, get transactions from the platform account
        const platformPayments = await stripe.paymentIntents.list({
            limit: parseInt(limit),
            expand: ['data.payment_method', 'data.customer']
        });

        console.log(`Platform account: ${platformPayments.data.length} transactions`);
        
        const platformTransactions = platformPayments.data.map(payment => ({
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            description: payment.description,
            customer: payment.customer ? {
                id: payment.customer,
                email: payment.receipt_email,
            } : undefined,
            payment_method: payment.payment_method ? {
                type: payment.payment_method.type,
                card: payment.payment_method.card ? {
                    brand: payment.payment_method.card.brand,
                    last4: payment.payment_method.card.last4,
                } : undefined,
            } : undefined,
            created: payment.created,
            metadata: payment.metadata,
            fee: payment.application_fee_amount,
            net: payment.amount - (payment.application_fee_amount || 0),
            amount_received: payment.amount_received,
            amount_capturable: payment.amount_capturable,
            capture_method: payment.capture_method,
            confirmation_method: payment.confirmation_method,
            payment_method_types: payment.payment_method_types,
            stripe_account: 'platform',
        }));

        allTransactions = [...platformTransactions];

        // Now get all Connect accounts and their transactions
        try {
            const accounts = await stripe.accounts.list({ limit: 100 });
            console.log(`Found ${accounts.data.length} connected accounts`);

            for (const account of accounts.data) {
                try {
                    console.log(`Fetching transactions for Connect account: ${account.id}`);
                    
                    const connectPayments = await stripe.paymentIntents.list({
                        limit: parseInt(limit),
                        expand: ['data.payment_method', 'data.customer']
                    }, {
                        stripeAccount: account.id
                    });

                    console.log(`Connect account ${account.id}: ${connectPayments.data.length} transactions`);

                    const connectTransactions = connectPayments.data.map(payment => ({
                        id: payment.id,
                        amount: payment.amount,
                        currency: payment.currency,
                        status: payment.status,
                        description: payment.description,
                        customer: payment.customer ? {
                            id: payment.customer,
                            email: payment.receipt_email,
                        } : undefined,
                        payment_method: payment.payment_method ? {
                            type: payment.payment_method.type,
                            card: payment.payment_method.card ? {
                                brand: payment.payment_method.card.brand,
                                last4: payment.payment_method.card.last4,
                            } : undefined,
                        } : undefined,
                        created: payment.created,
                        metadata: payment.metadata,
                        fee: payment.application_fee_amount,
                        net: payment.amount - (payment.application_fee_amount || 0),
                        amount_received: payment.amount_received,
                        amount_capturable: payment.amount_capturable,
                        capture_method: payment.capture_method,
                        confirmation_method: payment.confirmation_method,
                        payment_method_types: payment.payment_method_types,
                        stripe_account: account.id,
                        account_email: account.email,
                    }));

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

        // Sort all transactions by creation date (newest first)
        allTransactions.sort((a, b) => b.created - a.created);

        // Calculate summary
        allSummary = allTransactions.reduce((acc, payment) => {
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

        console.log(`Total transactions from all accounts: ${allTransactions.length}`);
        console.log('Summary:', allSummary);

        res.json({
            transactions: {
                data: allTransactions,
                has_more: false, // We're fetching all available
                total_count: allTransactions.length,
            },
            summary: allSummary
        });
    } catch (error) {
        console.error('Error fetching all transactions:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
