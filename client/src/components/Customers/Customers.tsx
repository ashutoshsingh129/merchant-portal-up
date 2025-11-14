import React, { useState, useEffect, useCallback } from 'react';
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
    Grid,
    CircularProgress,
    Alert,
    Button,
    Tooltip,
    Chip,
} from '@mui/material';
import { CheckCircle, Error, Refresh } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { stripeService, StripeCustomer } from '../../services/stripeService';

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
        whiteSpace: 'nowrap',
    },
    '& .MuiTableHead-root .MuiTableCell-root': {
        backgroundColor: '#f8fafc',
        fontWeight: 600,
        color: '#374151',
        fontSize: '0.875rem',
        whiteSpace: 'nowrap',
        minWidth: '120px',
    },
    '& .MuiTableCell-root:nth-of-type(1)': { minWidth: '150px' }, // Name
    '& .MuiTableCell-root:nth-of-type(2)': { minWidth: '200px' }, // Email
    '& .MuiTableCell-root:nth-of-type(3)': { minWidth: '150px' }, // Phone
    '& .MuiTableCell-root:nth-of-type(4)': { minWidth: '120px' }, // Balance
    '& .MuiTableCell-root:nth-of-type(5)': { minWidth: '120px' }, // Currency
    '& .MuiTableCell-root:nth-of-type(6)': { minWidth: '120px' }, // Delinquent
    '& .MuiTableCell-root:nth-of-type(7)': { minWidth: '200px' }, // Address
    '& .MuiTableCell-root:nth-of-type(8)': { minWidth: '200px' }, // Shipping Address
    '& .MuiTableCell-root:nth-of-type(9)': { minWidth: '150px' }, // Description
    '& .MuiTableCell-root:nth-of-type(10)': { minWidth: '120px' }, // Tax Exempt
    '& .MuiTableCell-root:nth-of-type(11)': { minWidth: '140px' }, // Created
}));

const Customers: React.FC = () => {
    const [customers, setCustomers] = useState<StripeCustomer[]>([]);
    const [summary, setSummary] = useState({
        total: 0,
        delinquent: 0,
        with_email: 0,
        with_phone: 0,
        with_balance: 0,
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

            const response = await stripeService.getAllCustomersFast({
                limit: 50,
                page: currentPage,
            });

            if (response.success) {
                // Filter customers on the client side based on selectedSummary
                let filtered = response.data.customers.data;
                if (selectedSummary !== 'all') {
                    filtered = response.data.customers.data.filter(customer => {
                        switch (selectedSummary) {
                            case 'delinquent':
                                return customer.delinquent;
                            case 'with_email':
                                return customer.email;
                            case 'with_phone':
                                return customer.phone;
                            case 'with_balance':
                                return customer.balance && customer.balance > 0;
                            default:
                                return true;
                        }
                    });
                }
                setCustomers(filtered);
                setHasMore(response.data.customers.has_more);
                setSummary(response.data.summary);
                console.log(
                    `Customers: Received ${response.data.customers.data.length} customers, filtered to ${filtered.length}, total: ${response.data.customers.total_count}, has_more: ${response.data.customers.has_more}`
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

    const clearCache = async () => {
        try {
            await stripeService.clearCache();
            setCurrentPage(1);
            setCustomers([]);
            fetchData();
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    };

    const handleSummaryClick = (type: string) => {
        setSelectedSummary(type);
        setCurrentPage(1);
        setCustomers([]);
    };

    const formatAddress = (address: StripeCustomer['address']): string => {
        if (!address) return '-';
        const parts = [];
        if (address.line1) parts.push(address.line1);
        if (address.city) parts.push(address.city);
        if (address.state) parts.push(address.state);
        if (address.postal_code) parts.push(address.postal_code);
        if (address.country) parts.push(address.country);
        return parts.length > 0 ? parts.join(', ') : '-';
    };

    const formatShippingAddress = (
        shipping: StripeCustomer['shipping']
    ): string => {
        if (!shipping || !shipping.address) return '-';
        const addr = shipping.address;
        const parts = [];
        if (addr.line1) parts.push(addr.line1);
        if (addr.city) parts.push(addr.city);
        if (addr.state) parts.push(addr.state);
        if (addr.postal_code) parts.push(addr.postal_code);
        if (addr.country) parts.push(addr.country);
        return parts.length > 0 ? parts.join(', ') : '-';
    };

    if (loading) {
        return (
            <StyledContainer>
                <HeaderSection>
                    <PageTitle>Customers</PageTitle>
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
                    <PageTitle>Customers</PageTitle>
                    <Tooltip title="Cache expires in 2 minutes. Click to refresh with latest data.">
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
                <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
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
                <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                    <SummaryCard
                        className={
                            selectedSummary === 'delinquent' ? 'selected' : ''
                        }
                        onClick={() => handleSummaryClick('delinquent')}
                        sx={{ cursor: 'pointer' }}
                    >
                        <SummaryCardContent>
                            <SummaryNumber>{summary.delinquent}</SummaryNumber>
                            <SummaryLabel>Delinquent</SummaryLabel>
                        </SummaryCardContent>
                    </SummaryCard>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                    <SummaryCard
                        className={
                            selectedSummary === 'with_email' ? 'selected' : ''
                        }
                        onClick={() => handleSummaryClick('with_email')}
                        sx={{ cursor: 'pointer' }}
                    >
                        <SummaryCardContent>
                            <SummaryNumber>{summary.with_email}</SummaryNumber>
                            <SummaryLabel>With Email</SummaryLabel>
                        </SummaryCardContent>
                    </SummaryCard>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                    <SummaryCard
                        className={
                            selectedSummary === 'with_phone' ? 'selected' : ''
                        }
                        onClick={() => handleSummaryClick('with_phone')}
                        sx={{ cursor: 'pointer' }}
                    >
                        <SummaryCardContent>
                            <SummaryNumber>{summary.with_phone}</SummaryNumber>
                            <SummaryLabel>With Phone</SummaryLabel>
                        </SummaryCardContent>
                    </SummaryCard>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                    <SummaryCard
                        className={
                            selectedSummary === 'with_balance' ? 'selected' : ''
                        }
                        onClick={() => handleSummaryClick('with_balance')}
                        sx={{ cursor: 'pointer' }}
                    >
                        <SummaryCardContent>
                            <SummaryNumber>
                                {summary.with_balance}
                            </SummaryNumber>
                            <SummaryLabel>With Balance</SummaryLabel>
                        </SummaryCardContent>
                    </SummaryCard>
                </Grid>
            </Grid>

            {/* Customers Table */}
            <Box sx={{ px: 2 }}>
                <TableContainer
                    component={Paper}
                    sx={{
                        boxShadow: 'none',
                        overflowX: 'auto',
                        minWidth: '100%',
                    }}
                >
                    <StyledTable>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell>Phone</TableCell>
                                <TableCell>Balance</TableCell>
                                <TableCell>Currency</TableCell>
                                <TableCell>Delinquent</TableCell>
                                <TableCell>Address</TableCell>
                                <TableCell>Shipping Address</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Tax Exempt</TableCell>
                                <TableCell>Created</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {customers.map(customer => (
                                <TableRow key={customer.id}>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {customer.name || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {customer.email || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {customer.phone || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color:
                                                    customer.balance !== 0
                                                        ? customer.balance > 0
                                                            ? '#10b981'
                                                            : '#ef4444'
                                                        : 'inherit',
                                            }}
                                        >
                                            {customer.balance !== 0
                                                ? customer.currency
                                                    ? stripeService.formatAmount(
                                                          Math.abs(
                                                              customer.balance
                                                          ),
                                                          customer.currency
                                                      )
                                                    : `${customer.balance / 100}`
                                                : '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {customer.currency?.toUpperCase() ||
                                                '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Box
                                            display="flex"
                                            alignItems="center"
                                            gap={1}
                                        >
                                            {customer.delinquent ? (
                                                <Error
                                                    sx={{
                                                        color: '#ef4444',
                                                        fontSize: 16,
                                                    }}
                                                />
                                            ) : (
                                                <CheckCircle
                                                    sx={{
                                                        color: '#10b981',
                                                        fontSize: 16,
                                                    }}
                                                />
                                            )}
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    color: customer.delinquent
                                                        ? '#ef4444'
                                                        : '#10b981',
                                                }}
                                            >
                                                {customer.delinquent
                                                    ? 'Yes'
                                                    : 'No'}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {formatAddress(customer.address)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {formatShippingAddress(
                                                customer.shipping
                                            )}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {customer.description || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {customer.tax_exempt || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {stripeService.formatDate(
                                                customer.created
                                            )}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </StyledTable>
                </TableContainer>

                {customers.length === 0 && !loading && (
                    <Box textAlign="center" py={4}>
                        <Typography variant="body1" color="text.secondary">
                            No customers found
                        </Typography>
                    </Box>
                )}
            </Box>
        </StyledContainer>
    );
};

export default Customers;
