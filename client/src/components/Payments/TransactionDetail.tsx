import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    Card,
    CardContent,
    CircularProgress,
    Alert,
    Button,
    Grid,
    Link,
    Divider,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { stripeService, StripeTransaction } from '../../services/stripeService';

const StyledContainer = styled(Box)(({ theme }) => ({
    padding: theme.spacing(3),
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
}));

const HeaderSection = styled(Box)(({ theme }) => ({
    marginBottom: theme.spacing(3),
    padding: theme.spacing(2),
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
}));

const SectionCard = styled(Card)(({ theme }) => ({
    marginBottom: theme.spacing(3),
    borderRadius: theme.spacing(1),
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
}));

const PaymentMethodCard = styled(SectionCard)(({ theme }) => ({
    minHeight: '300px', // Ensure minimum height to match Payment breakdown card
}));

const PaymentBreakdownCard = styled(SectionCard)(({ theme }) => ({
    minHeight: '300px', // Ensure minimum height to match Payment method card
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#2d3748',
    marginBottom: theme.spacing(2),
}));

const DetailRow = styled(Box)(({ theme }) => ({
    display: 'flex',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5, 0),
    borderBottom: '1px solid #f1f5f9',
    '&:last-child': {
        borderBottom: 'none',
    },
}));

const DetailLabel = styled(Typography)(({ theme }) => ({
    fontSize: '0.875rem',
    color: '#64748b',
    fontWeight: 500,
}));

const DetailValue = styled(Typography)(({ theme }) => ({
    fontSize: '0.875rem',
    color: '#1e293b',
    fontWeight: 400,
}));

const AmountValue = styled(Typography)(({ theme }) => ({
    fontSize: '1rem',
    fontWeight: 600,
    color: '#1e293b',
}));

const NetAmountValue = styled(Typography)(({ theme }) => ({
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#1e293b',
}));

const TransactionDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [transaction, setTransaction] = useState<StripeTransaction | null>(
        null
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTransaction = async () => {
            if (!id) {
                setError('Transaction ID is required');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const response = await stripeService.getTransaction(id);
                if (response.success && response.data) {
                    setTransaction(response.data);
                } else {
                    setError(response.message || 'Failed to fetch transaction');
                }
            } catch (err) {
                setError(
                    err instanceof Error ? err.message : 'An error occurred'
                );
            } finally {
                setLoading(false);
            }
        };

        fetchTransaction();
    }, [id]);

    const formatAmount = (amount: number, currency: string): string => {
        return stripeService.formatAmount(amount, currency);
    };

    const formatDate = (timestamp: number): string => {
        return new Date(timestamp * 1000).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const formatAddress = (address: any): string => {
        if (!address) return 'No address';
        const parts = [
            address.line1,
            address.line2,
            address.city,
            address.state,
            address.postal_code,
            address.country,
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : 'No address';
    };

    if (loading) {
        return (
            <StyledContainer>
                <Box
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    minHeight="50vh"
                >
                    <CircularProgress />
                </Box>
            </StyledContainer>
        );
    }

    if (error || !transaction) {
        return (
            <StyledContainer>
                <Alert severity="error">
                    {error || 'Transaction not found'}
                </Alert>
                <Box mt={2}>
                    <Button
                        startIcon={<ArrowBack />}
                        onClick={() => navigate('/payments')}
                        variant="outlined"
                    >
                        Back to Payments
                    </Button>
                </Box>
            </StyledContainer>
        );
    }

    const stripeFee = transaction.stripe_fee || 0;
    const netAmount = transaction.net_amount || transaction.amount - stripeFee;
    const paymentMethod = transaction.payment_method;
    const isBankAccount = paymentMethod?.type === 'us_bank_account';
    const bankAccount = paymentMethod?.us_bank_account;

    return (
        <StyledContainer>
            <HeaderSection>
                <Button
                    startIcon={<ArrowBack />}
                    onClick={() => navigate('/payments')}
                    variant="outlined"
                    sx={{ minWidth: 'auto' }}
                >
                    Back
                </Button>
                <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
                    Transaction Details
                </Typography>
            </HeaderSection>

            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <PaymentBreakdownCard>
                        <CardContent
                            sx={{
                                flexGrow: 1,
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            <SectionTitle>Payment breakdown</SectionTitle>
                            <DetailRow>
                                <DetailLabel>Payment amount</DetailLabel>
                                <AmountValue>
                                    {formatAmount(
                                        transaction.amount,
                                        transaction.currency
                                    )}
                                </AmountValue>
                            </DetailRow>
                            <DetailRow>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <DetailLabel>
                                        Stripe processing fees
                                    </DetailLabel>
                                    <Link
                                        href="https://stripe.com/pricing"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        sx={{ fontSize: '0.75rem' }}
                                    >
                                        Learn more
                                    </Link>
                                </Box>
                                <AmountValue sx={{ color: '#ef4444' }}>
                                    -{' '}
                                    {formatAmount(
                                        stripeFee,
                                        transaction.currency
                                    )}
                                </AmountValue>
                            </DetailRow>
                            <Divider sx={{ my: 2 }} />
                            <DetailRow>
                                <DetailLabel sx={{ fontWeight: 600 }}>
                                    Net amount
                                </DetailLabel>
                                <NetAmountValue>
                                    {formatAmount(
                                        netAmount,
                                        transaction.currency
                                    )}
                                </NetAmountValue>
                            </DetailRow>
                        </CardContent>
                    </PaymentBreakdownCard>
                </Grid>

                <Grid item xs={12} md={6}>
                    <PaymentMethodCard>
                        <CardContent
                            sx={{
                                flexGrow: 1,
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            <SectionTitle>Payment method</SectionTitle>
                            {paymentMethod && (
                                <>
                                    <DetailRow>
                                        <DetailLabel>ID</DetailLabel>
                                        <DetailValue>
                                            {paymentMethod.id || 'N/A'}
                                        </DetailValue>
                                    </DetailRow>
                                    <DetailRow>
                                        <DetailLabel>Type</DetailLabel>
                                        <DetailValue>
                                            {paymentMethod.type}
                                        </DetailValue>
                                    </DetailRow>

                                    {isBankAccount && bankAccount && (
                                        <>
                                            {bankAccount.bank_name && (
                                                <DetailRow>
                                                    <DetailLabel>
                                                        Bank name
                                                    </DetailLabel>
                                                    <DetailValue>
                                                        {bankAccount.bank_name}
                                                    </DetailValue>
                                                </DetailRow>
                                            )}
                                            {bankAccount.routing_number && (
                                                <DetailRow>
                                                    <DetailLabel>
                                                        Routing number
                                                    </DetailLabel>
                                                    <DetailValue>
                                                        {
                                                            bankAccount.routing_number
                                                        }
                                                    </DetailValue>
                                                </DetailRow>
                                            )}
                                            {bankAccount.last4 && (
                                                <DetailRow>
                                                    <DetailLabel>
                                                        Account number
                                                    </DetailLabel>
                                                    <DetailValue>
                                                        ....{bankAccount.last4}
                                                    </DetailValue>
                                                </DetailRow>
                                            )}
                                            {bankAccount.fingerprint && (
                                                <DetailRow>
                                                    <DetailLabel>
                                                        Fingerprint
                                                    </DetailLabel>
                                                    <DetailValue>
                                                        <Link
                                                            href={`https://dashboard.stripe.com/payment_methods/${paymentMethod.id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            sx={{
                                                                color: '#2563eb',
                                                            }}
                                                        >
                                                            {
                                                                bankAccount.fingerprint
                                                            }
                                                        </Link>
                                                    </DetailValue>
                                                </DetailRow>
                                            )}
                                        </>
                                    )}

                                    {transaction.payment_reference && (
                                        <DetailRow>
                                            <DetailLabel>
                                                Payment reference
                                            </DetailLabel>
                                            <DetailValue
                                                sx={{ wordBreak: 'break-all' }}
                                            >
                                                {transaction.payment_reference}
                                            </DetailValue>
                                        </DetailRow>
                                    )}

                                    {paymentMethod.billing_details && (
                                        <>
                                            {paymentMethod.billing_details
                                                .name && (
                                                <DetailRow>
                                                    <DetailLabel>
                                                        Owner
                                                    </DetailLabel>
                                                    <DetailValue>
                                                        {
                                                            paymentMethod
                                                                .billing_details
                                                                .name
                                                        }
                                                    </DetailValue>
                                                </DetailRow>
                                            )}
                                            <DetailRow>
                                                <DetailLabel>
                                                    Address
                                                </DetailLabel>
                                                <DetailValue>
                                                    {formatAddress(
                                                        paymentMethod
                                                            .billing_details
                                                            .address
                                                    )}
                                                </DetailValue>
                                            </DetailRow>
                                        </>
                                    )}

                                    {!isBankAccount && paymentMethod.card && (
                                        <>
                                            <DetailRow>
                                                <DetailLabel>
                                                    Card brand
                                                </DetailLabel>
                                                <DetailValue>
                                                    {paymentMethod.card.brand?.toUpperCase() ||
                                                        'N/A'}
                                                </DetailValue>
                                            </DetailRow>
                                            <DetailRow>
                                                <DetailLabel>
                                                    Last 4 digits
                                                </DetailLabel>
                                                <DetailValue>
                                                    {paymentMethod.card.last4
                                                        ? `....${paymentMethod.card.last4}`
                                                        : 'N/A'}
                                                </DetailValue>
                                            </DetailRow>
                                            {paymentMethod.card.exp_month &&
                                                paymentMethod.card.exp_year && (
                                                    <DetailRow>
                                                        <DetailLabel>
                                                            Expires
                                                        </DetailLabel>
                                                        <DetailValue>
                                                            {String(
                                                                paymentMethod
                                                                    .card
                                                                    .exp_month
                                                            ).padStart(2, '0')}
                                                            /
                                                            {
                                                                paymentMethod
                                                                    .card
                                                                    .exp_year
                                                            }
                                                        </DetailValue>
                                                    </DetailRow>
                                                )}
                                            {paymentMethod.card.funding && (
                                                <DetailRow>
                                                    <DetailLabel>
                                                        Funding
                                                    </DetailLabel>
                                                    <DetailValue>
                                                        {
                                                            paymentMethod.card
                                                                .funding
                                                        }
                                                    </DetailValue>
                                                </DetailRow>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                            {!paymentMethod && (
                                <DetailRow>
                                    <DetailValue sx={{ color: '#64748b' }}>
                                        No payment method information available
                                    </DetailValue>
                                </DetailRow>
                            )}
                        </CardContent>
                    </PaymentMethodCard>
                </Grid>

                <Grid item xs={12}>
                    <SectionCard>
                        <CardContent>
                            <SectionTitle>Transaction Information</SectionTitle>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6} md={3}>
                                    <DetailRow
                                        sx={{
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                        }}
                                    >
                                        <DetailLabel>
                                            Transaction ID
                                        </DetailLabel>
                                        <DetailValue
                                            sx={{ wordBreak: 'break-all' }}
                                        >
                                            {transaction.id}
                                        </DetailValue>
                                    </DetailRow>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <DetailRow
                                        sx={{
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                        }}
                                    >
                                        <DetailLabel>Status</DetailLabel>
                                        <DetailValue>
                                            {transaction.status}
                                        </DetailValue>
                                    </DetailRow>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <DetailRow
                                        sx={{
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                        }}
                                    >
                                        <DetailLabel>Created</DetailLabel>
                                        <DetailValue>
                                            {formatDate(transaction.created)}
                                        </DetailValue>
                                    </DetailRow>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <DetailRow
                                        sx={{
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                        }}
                                    >
                                        <DetailLabel>Currency</DetailLabel>
                                        <DetailValue>
                                            {transaction.currency.toUpperCase()}
                                        </DetailValue>
                                    </DetailRow>
                                </Grid>
                                {transaction.description && (
                                    <Grid item xs={12}>
                                        <DetailRow
                                            sx={{
                                                flexDirection: 'column',
                                                alignItems: 'flex-start',
                                            }}
                                        >
                                            <DetailLabel>
                                                Description
                                            </DetailLabel>
                                            <DetailValue>
                                                {transaction.description}
                                            </DetailValue>
                                        </DetailRow>
                                    </Grid>
                                )}
                                {transaction.customer && (
                                    <>
                                        <Grid item xs={12} sm={6}>
                                            <DetailRow
                                                sx={{
                                                    flexDirection: 'column',
                                                    alignItems: 'flex-start',
                                                }}
                                            >
                                                <DetailLabel>
                                                    Customer ID
                                                </DetailLabel>
                                                <DetailValue>
                                                    {transaction.customer.id}
                                                </DetailValue>
                                            </DetailRow>
                                        </Grid>
                                        {transaction.customer.email && (
                                            <Grid item xs={12} sm={6}>
                                                <DetailRow
                                                    sx={{
                                                        flexDirection: 'column',
                                                        alignItems:
                                                            'flex-start',
                                                    }}
                                                >
                                                    <DetailLabel>
                                                        Customer Email
                                                    </DetailLabel>
                                                    <DetailValue>
                                                        {
                                                            transaction.customer
                                                                .email
                                                        }
                                                    </DetailValue>
                                                </DetailRow>
                                            </Grid>
                                        )}
                                    </>
                                )}
                            </Grid>
                        </CardContent>
                    </SectionCard>
                </Grid>
            </Grid>
        </StyledContainer>
    );
};

export default TransactionDetail;
