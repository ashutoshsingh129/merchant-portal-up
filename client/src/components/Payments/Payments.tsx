import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    Grid,
    CircularProgress,
    Alert,
} from '@mui/material';
import {
    CheckCircle,
    Schedule,
    Error,
    Cancel,
    Refresh,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { stripeService, StripeTransaction } from '../../services/stripeService';

const StyledContainer = styled(Box)(({ theme }) => ({
    padding: theme.spacing(1),
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
}));

const HeaderSection = styled(Box)(({ theme }) => ({
    marginBottom: theme.spacing(3),
    padding: theme.spacing(2),
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
}));

const PageTitle = styled(Typography)(({ theme }) => ({
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#2d3748',
}));

const SummaryCard = styled(Card)(({ theme }) => ({
    borderRadius: theme.spacing(1),
    border: '1px solid #e2e8f0',
    '&.selected': {
        borderColor: '#7c3aed',
        backgroundColor: '#faf5ff',
    },
}));

const SummaryCardContent = styled(CardContent)(({ theme }) => ({
    padding: theme.spacing(2),
    '&:last-child': {
        paddingBottom: theme.spacing(2),
    },
}));

const SummaryNumber = styled(Typography)(({ theme }) => ({
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#7c3aed',
}));

const SummaryLabel = styled(Typography)(({ theme }) => ({
    fontSize: '0.875rem',
    color: '#4a5568',
    marginTop: theme.spacing(0.5),
}));

const StyledTable = styled(Table)(({ theme }) => ({
    '& .MuiTableCell-root': {
        borderBottom: '1px solid #e2e8f0',
        padding: theme.spacing(1.5),
        whiteSpace: 'nowrap', // Prevent text wrapping
    },
    '& .MuiTableHead-root .MuiTableCell-root': {
        backgroundColor: '#f8fafc',
        fontWeight: 600,
        color: '#374151',
        fontSize: '0.875rem',
        whiteSpace: 'nowrap', // Prevent header text wrapping
        minWidth: '120px', // Set minimum width for headers
    },
    // Set specific widths for columns
    '& .MuiTableCell-root:nth-of-type(1)': { minWidth: '120px' }, // Amount
    '& .MuiTableCell-root:nth-of-type(2)': { minWidth: '120px' }, // Status
    '& .MuiTableCell-root:nth-of-type(3)': { minWidth: '150px' }, // Payment Method
    '& .MuiTableCell-root:nth-of-type(4)': { minWidth: '120px' }, // Amount Received
    '& .MuiTableCell-root:nth-of-type(5)': { minWidth: '120px' }, // Refunded Amount
    '& .MuiTableCell-root:nth-of-type(6)': { minWidth: '120px' }, // Decline Reason
    '& .MuiTableCell-root:nth-of-type(7)': { minWidth: '150px' }, // Settlement Merchant
    '& .MuiTableCell-root:nth-of-type(8)': { minWidth: '150px' }, // Terminal Location
    '& .MuiTableCell-root:nth-of-type(9)': { minWidth: '150px' }, // Description
    '& .MuiTableCell-root:nth-of-type(10)': { minWidth: '150px' }, // Customer
    '& .MuiTableCell-root:nth-of-type(11)': { minWidth: '150px' }, // Account
    '& .MuiTableCell-root:nth-of-type(12)': { minWidth: '140px' }, // Date
}));

const CardBrandBox = styled(Box)(({ theme }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
    backgroundColor: '#f3f4f6',
    borderRadius: theme.spacing(0.5),
    fontSize: '0.625rem',
    fontWeight: 'bold',
}));

const Payments: React.FC = () => {
    const [transactions, setTransactions] = useState<StripeTransaction[]>([]);
    const [summary, setSummary] = useState({
        total: 0,
        succeeded: 0,
        pending: 0,
        failed: 0,
        refunded: 0,
        disputed: 0,
        uncaptured: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSummary, setSelectedSummary] = useState('all');
    const hasFetched = useRef(false);

    useEffect(() => {
        // Prevent duplicate calls in React StrictMode
        if (!hasFetched.current) {
            hasFetched.current = true;
            fetchData();
        }
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Use the new method that fetches from ALL accounts (platform + Connect)
            const response = await stripeService.getAllTransactionsWithSummary({
                limit: 500, // Show more transactions from all accounts
            });

            if (response.success) {
                setTransactions(response.data.transactions.data);
                setSummary(response.data.summary);
            } else {
                setError(response.message);
            }
        } catch (err) {
            setError('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleSummaryClick = (type: string) => {
        setSelectedSummary(type);
        // In a real app, this would filter transactions
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'succeeded':
                return <CheckCircle sx={{ color: '#10b981', fontSize: 16 }} />;
            case 'pending':
                return <Schedule sx={{ color: '#f59e0b', fontSize: 16 }} />;
            case 'failed':
                return <Error sx={{ color: '#ef4444', fontSize: 16 }} />;
            case 'canceled':
                return <Cancel sx={{ color: '#ef4444', fontSize: 16 }} />;
            default:
                return <Schedule sx={{ color: '#6b7280', fontSize: 16 }} />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'succeeded':
                return '#10b981';
            case 'pending':
                return '#f59e0b';
            case 'failed':
                return '#ef4444';
            case 'canceled':
                return '#ef4444';
            default:
                return '#6b7280';
        }
    };

    if (loading) {
        return (
            <StyledContainer>
                <HeaderSection>
                    <PageTitle>Payments</PageTitle>
                </HeaderSection>
                <Box
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    minHeight="400px"
                >
                    <CircularProgress />
                </Box>
            </StyledContainer>
        );
    }

    return (
        <StyledContainer>
            <HeaderSection>
                <PageTitle>Payments</PageTitle>
            </HeaderSection>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 3, px: 2 }}>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <SummaryCard
                        className={selectedSummary === 'all' ? 'selected' : ''}
                        onClick={() => handleSummaryClick('all')}
                        sx={{ cursor: 'pointer' }}
                    >
                        <SummaryCardContent>
                            <SummaryNumber>{summary.total}</SummaryNumber>
                            <SummaryLabel>All</SummaryLabel>
                        </SummaryCardContent>
                    </SummaryCard>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <SummaryCard
                        className={
                            selectedSummary === 'succeeded' ? 'selected' : ''
                        }
                        onClick={() => handleSummaryClick('succeeded')}
                        sx={{ cursor: 'pointer' }}
                    >
                        <SummaryCardContent>
                            <SummaryNumber>{summary.succeeded}</SummaryNumber>
                            <SummaryLabel>Succeeded</SummaryLabel>
                        </SummaryCardContent>
                    </SummaryCard>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <SummaryCard
                        className={
                            selectedSummary === 'pending' ? 'selected' : ''
                        }
                        onClick={() => handleSummaryClick('pending')}
                        sx={{ cursor: 'pointer' }}
                    >
                        <SummaryCardContent>
                            <SummaryNumber>{summary.pending}</SummaryNumber>
                            <SummaryLabel>Pending</SummaryLabel>
                        </SummaryCardContent>
                    </SummaryCard>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <SummaryCard
                        className={
                            selectedSummary === 'failed' ? 'selected' : ''
                        }
                        onClick={() => handleSummaryClick('failed')}
                        sx={{ cursor: 'pointer' }}
                    >
                        <SummaryCardContent>
                            <SummaryNumber>{summary.failed}</SummaryNumber>
                            <SummaryLabel>Failed</SummaryLabel>
                        </SummaryCardContent>
                    </SummaryCard>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <SummaryCard
                        className={
                            selectedSummary === 'disputed' ? 'selected' : ''
                        }
                        onClick={() => handleSummaryClick('disputed')}
                        sx={{ cursor: 'pointer' }}
                    >
                        <SummaryCardContent>
                            <SummaryNumber>{summary.disputed}</SummaryNumber>
                            <SummaryLabel>Disputed</SummaryLabel>
                        </SummaryCardContent>
                    </SummaryCard>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <SummaryCard
                        className={
                            selectedSummary === 'uncaptured' ? 'selected' : ''
                        }
                        onClick={() => handleSummaryClick('uncaptured')}
                        sx={{ cursor: 'pointer' }}
                    >
                        <SummaryCardContent>
                            <SummaryNumber>{summary.uncaptured}</SummaryNumber>
                            <SummaryLabel>Uncaptured</SummaryLabel>
                        </SummaryCardContent>
                    </SummaryCard>
                </Grid>
            </Grid>

            {/* Transactions Table */}
            <Box sx={{ px: 2 }}>
                <TableContainer
                    component={Paper}
                    sx={{
                        boxShadow: 'none',
                        overflowX: 'auto', // Enable horizontal scrolling
                        minWidth: '100%',
                    }}
                >
                    <StyledTable>
                        <TableHead>
                            <TableRow>
                                <TableCell>Amount</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Payment Method</TableCell>
                                <TableCell>Amount Received</TableCell>
                                <TableCell>Refunded Amount</TableCell>
                                <TableCell>Decline Reason</TableCell>
                                <TableCell>Settlement Merchant</TableCell>
                                <TableCell>Terminal Location</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Customer</TableCell>
                                <TableCell>Account</TableCell>
                                <TableCell>Date</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {transactions.map(transaction => (
                                <TableRow key={transaction.id}>
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            fontWeight={500}
                                        >
                                            {stripeService.formatAmount(
                                                transaction.amount,
                                                transaction.currency
                                            )}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Box
                                            display="flex"
                                            alignItems="center"
                                            gap={1}
                                        >
                                            {getStatusIcon(transaction.status)}
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: getStatusColor(
                                                        transaction.status
                                                    ),
                                                }}
                                            >
                                                {transaction.status}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        {transaction.payment_method?.card ? (
                                            <CardBrandBox>
                                                <Typography
                                                    variant="caption"
                                                    fontWeight="bold"
                                                >
                                                    {transaction.payment_method.card.brand.toUpperCase()}
                                                </Typography>
                                                <Typography variant="caption">
                                                    ....
                                                    {
                                                        transaction
                                                            .payment_method.card
                                                            .last4
                                                    }
                                                </Typography>
                                            </CardBrandBox>
                                        ) : (
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                -
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {transaction.amount_received
                                                ? stripeService.formatAmount(
                                                      transaction.amount_received,
                                                      transaction.currency
                                                  )
                                                : '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color:
                                                    transaction.refunded_amount &&
                                                    transaction.refunded_amount >
                                                        0
                                                        ? '#f59e0b'
                                                        : 'inherit',
                                            }}
                                        >
                                            {transaction.refunded_amount &&
                                            transaction.refunded_amount > 0
                                                ? stripeService.formatAmount(
                                                      transaction.refunded_amount,
                                                      transaction.currency
                                                  )
                                                : '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: transaction.decline_reason
                                                    ? '#ef4444'
                                                    : 'inherit',
                                            }}
                                        >
                                            {transaction.decline_reason || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {transaction.settlement_merchant ||
                                                '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {transaction.terminal_location ||
                                                '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {transaction.description || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {transaction.customer?.email || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            {transaction.stripe_account ===
                                            'platform'
                                                ? 'Platform'
                                                : transaction.account_email ||
                                                  transaction.stripe_account ||
                                                  '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {stripeService.formatDate(
                                                transaction.created
                                            )}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </StyledTable>
                </TableContainer>

                {transactions.length === 0 && !loading && (
                    <Box textAlign="center" py={4}>
                        <Typography variant="body1" color="text.secondary">
                            No transactions found
                        </Typography>
                    </Box>
                )}
            </Box>
        </StyledContainer>
    );
};

export default Payments;
