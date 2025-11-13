import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    Button,
    Tooltip,
} from '@mui/material';
import {
    CheckCircle,
    Schedule,
    Error,
    Cancel,
    LocalShipping,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { stripeService, StripePayout } from '../../services/stripeService';

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
    '& .MuiTableCell-root:nth-of-type(3)': { minWidth: '120px' }, // Method
    '& .MuiTableCell-root:nth-of-type(4)': { minWidth: '120px' }, // Type
    '& .MuiTableCell-root:nth-of-type(5)': { minWidth: '120px' }, // Source Type
    '& .MuiTableCell-root:nth-of-type(6)': { minWidth: '150px' }, // Destination
    '& .MuiTableCell-root:nth-of-type(7)': { minWidth: '150px' }, // Description
    '& .MuiTableCell-root:nth-of-type(8)': { minWidth: '150px' }, // Statement Descriptor
    '& .MuiTableCell-root:nth-of-type(9)': { minWidth: '150px' }, // Account
    '& .MuiTableCell-root:nth-of-type(10)': { minWidth: '140px' }, // Arrival Date
    '& .MuiTableCell-root:nth-of-type(11)': { minWidth: '140px' }, // Created Date
}));

const MethodBox = styled(Box)(({ theme }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
    backgroundColor: '#f3f4f6',
    borderRadius: theme.spacing(0.5),
    fontSize: '0.625rem',
    fontWeight: 'bold',
}));

const Payouts: React.FC = () => {
    const [payouts, setPayouts] = useState<StripePayout[]>([]);
    const [summary, setSummary] = useState({
        total: 0,
        paid: 0,
        pending: 0,
        in_transit: 0,
        canceled: 0,
        failed: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSummary, setSelectedSummary] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch platform payouts only
            const response = await stripeService.getAllPayoutsFast({
                limit: 50, // Smaller batches for faster loading
                page: currentPage,
                status: selectedSummary !== 'all' ? selectedSummary : undefined,
            });

            if (response.success) {
                // Always replace data to avoid duplicates
                // Backend handles pagination, so we just show what it returns
                setPayouts(response.data.payouts.data);
                setHasMore(response.data.payouts.has_more);
                setSummary(response.data.summary);
                console.log(
                    `Payouts: Received ${response.data.payouts.data.length} payouts, total: ${response.data.payouts.total_count}, has_more: ${response.data.payouts.has_more}`
                );
            } else {
                setError(response.message);
            }
        } catch (err) {
            setError('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    }, [currentPage, selectedSummary]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const loadMore = () => {
        if (hasMore && !loading) {
            setCurrentPage(prev => prev + 1);
        }
    };

    const clearCache = async () => {
        try {
            await stripeService.clearCache();
            // Refresh data after clearing cache
            setCurrentPage(1);
            setPayouts([]);
            fetchData();
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    };

    const handleSummaryClick = (type: string) => {
        setSelectedSummary(type);
        setCurrentPage(1); // Reset to first page when filter changes
        setPayouts([]); // Clear current payouts
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'paid':
                return <CheckCircle sx={{ color: '#10b981', fontSize: 16 }} />;
            case 'pending':
                return <Schedule sx={{ color: '#f59e0b', fontSize: 16 }} />;
            case 'in_transit':
                return (
                    <LocalShipping sx={{ color: '#3b82f6', fontSize: 16 }} />
                );
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
            case 'paid':
                return '#10b981';
            case 'pending':
                return '#f59e0b';
            case 'in_transit':
                return '#3b82f6';
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
                    <PageTitle>Payouts</PageTitle>
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
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <PageTitle>Payouts</PageTitle>
                    <Tooltip title="Cache expires in 5 minutes. Click to refresh with latest data.">
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={clearCache}
                            sx={{ ml: 2 }}
                        >
                            Clear Cache
                        </Button>
                    </Tooltip>
                </Box>
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
                        className={selectedSummary === 'paid' ? 'selected' : ''}
                        onClick={() => handleSummaryClick('paid')}
                        sx={{ cursor: 'pointer' }}
                    >
                        <SummaryCardContent>
                            <SummaryNumber>{summary.paid}</SummaryNumber>
                            <SummaryLabel>Paid</SummaryLabel>
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
                            selectedSummary === 'in_transit' ? 'selected' : ''
                        }
                        onClick={() => handleSummaryClick('in_transit')}
                        sx={{ cursor: 'pointer' }}
                    >
                        <SummaryCardContent>
                            <SummaryNumber>{summary.in_transit}</SummaryNumber>
                            <SummaryLabel>In Transit</SummaryLabel>
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
                            selectedSummary === 'canceled' ? 'selected' : ''
                        }
                        onClick={() => handleSummaryClick('canceled')}
                        sx={{ cursor: 'pointer' }}
                    >
                        <SummaryCardContent>
                            <SummaryNumber>{summary.canceled}</SummaryNumber>
                            <SummaryLabel>Canceled</SummaryLabel>
                        </SummaryCardContent>
                    </SummaryCard>
                </Grid>
            </Grid>

            {/* Payouts Table */}
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
                                <TableCell>Method</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Source Type</TableCell>
                                <TableCell>Destination</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Statement Descriptor</TableCell>
                                <TableCell>Account</TableCell>
                                <TableCell>Arrival Date</TableCell>
                                <TableCell>Created Date</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {payouts.map(payout => (
                                <TableRow key={payout.id}>
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            fontWeight={500}
                                        >
                                            {stripeService.formatAmount(
                                                payout.amount,
                                                payout.currency
                                            )}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Box
                                            display="flex"
                                            alignItems="center"
                                            gap={1}
                                        >
                                            {getStatusIcon(payout.status)}
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: getStatusColor(
                                                        payout.status
                                                    ),
                                                }}
                                            >
                                                {payout.status}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <MethodBox>
                                            <Typography
                                                variant="caption"
                                                fontWeight="bold"
                                            >
                                                {payout.method.toUpperCase()}
                                            </Typography>
                                        </MethodBox>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {payout.type || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {payout.source_type || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {payout.destination || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {payout.description || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {payout.statement_descriptor || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            {payout.stripe_account ===
                                            'platform'
                                                ? 'Platform'
                                                : payout.account_email ||
                                                  payout.stripe_account ||
                                                  '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {payout.arrival_date
                                                ? stripeService.formatDate(
                                                      payout.arrival_date
                                                  )
                                                : '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {stripeService.formatDate(
                                                payout.created
                                            )}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </StyledTable>
                </TableContainer>

                {payouts.length === 0 && !loading && (
                    <Box textAlign="center" py={4}>
                        <Typography variant="body1" color="text.secondary">
                            No payouts found
                        </Typography>
                    </Box>
                )}
            </Box>
        </StyledContainer>
    );
};

export default Payouts;
