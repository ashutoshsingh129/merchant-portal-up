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
        const { limit = 10, starting_after, ending_before, status, customer } = req.query;
        
        const params = {
            limit: parseInt(limit),
            ...(starting_after && { starting_after }),
            ...(ending_before && { ending_before }),
            ...(status && { status }),
            ...(customer && { customer }),
        };

        const payments = await stripe.paymentIntents.list(params);
        
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
        const { limit = 100, starting_after, ending_before, status, customer } = req.query;

        const params = {
            limit: parseInt(limit),
            ...(starting_after && { starting_after }),
            ...(ending_before && { ending_before }),
            ...(status && { status }),
            ...(customer && { customer }),
        };

        const payments = await stripe.paymentIntents.list(params);

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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
