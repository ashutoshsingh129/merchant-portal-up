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
    Popover,
    TextField,
    IconButton,
    InputAdornment,
} from '@mui/material';
import {
    CheckCircle,
    Schedule,
    Error,
    Cancel,
    Refresh,
    Add,
    Close,
    KeyboardArrowUp,
    KeyboardArrowDown,
    ArrowDropDown,
} from '@mui/icons-material';
import {
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Checkbox,
    ListItemText,
} from '@mui/material';
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
        refunded: 0,
        disputed: 0,
        failed: 0,
        uncaptured: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSummary, setSelectedSummary] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [cacheStatus, setCacheStatus] = useState<string>('fresh');
    const [dateFilterDays, setDateFilterDays] = useState<number | null>(null);
    const [dateFilterAnchor, setDateFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [dateFilterInput, setDateFilterInput] = useState<string>('1');

    // New filter states
    const [amountFilter, setAmountFilter] = useState<number | null>(null);
    const [amountOperator, setAmountOperator] = useState<string>('eq');
    const [amountFilterAnchor, setAmountFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [amountFilterInput, setAmountFilterInput] = useState<string>('0');

    const [currencyFilter, setCurrencyFilter] = useState<string | null>(null);
    const [currencyFilterAnchor, setCurrencyFilterAnchor] =
        useState<HTMLButtonElement | null>(null);

    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [statusFilterAnchor, setStatusFilterAnchor] =
        useState<HTMLButtonElement | null>(null);

    const [paymentMethodFilter, setPaymentMethodFilter] = useState<
        string | null
    >(null);
    const [paymentMethodFilterAnchor, setPaymentMethodFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [paymentMethodFilterInput, setPaymentMethodFilterInput] =
        useState<string>('');

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch platform transactions only
            const response = await stripeService.getAllTransactionsFast({
                limit: 50, // Smaller batches for faster loading
                page: currentPage,
                status: selectedSummary !== 'all' ? selectedSummary : undefined,
                days: dateFilterDays || undefined,
                amount: amountFilter !== null ? amountFilter : undefined,
                amountOperator:
                    amountFilter !== null ? amountOperator : undefined,
                currency: currencyFilter || undefined,
                paymentMethod: paymentMethodFilter || undefined,
            });

            if (response.success) {
                // Always replace data to avoid duplicates
                // Backend handles pagination, so we just show what it returns
                setTransactions(response.data.transactions.data);
                setHasMore(response.data.transactions.has_more);
                setSummary(response.data.summary);
                console.log(
                    `Payments: Received ${response.data.transactions.data.length} transactions, total: ${response.data.transactions.total_count}, has_more: ${response.data.transactions.has_more}`
                );
            } else {
                setError(response.message);
            }
        } catch (err) {
            setError('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    }, [
        currentPage,
        selectedSummary,
        dateFilterDays,
        amountFilter,
        amountOperator,
        currencyFilter,
        paymentMethodFilter,
    ]);

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
            setTransactions([]);
            fetchData();
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    };

    const handleSummaryClick = (type: string) => {
        setSelectedSummary(type);
        setCurrentPage(1); // Reset to first page when filter changes
        setTransactions([]); // Clear current transactions
    };

    const handleDateFilterClick = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        setDateFilterAnchor(event.currentTarget);
    };

    const handleDateFilterClose = () => {
        setDateFilterAnchor(null);
    };

    const handleDateFilterApply = () => {
        const days = parseInt(dateFilterInput);
        if (days > 0) {
            setDateFilterDays(days);
            setCurrentPage(1);
            setTransactions([]);
        }
        handleDateFilterClose();
    };

    const handleDateFilterClear = () => {
        setDateFilterDays(null);
        setDateFilterInput('1');
        setCurrentPage(1);
        setTransactions([]);
    };

    const incrementDays = () => {
        const current = parseInt(dateFilterInput) || 1;
        setDateFilterInput(String(current + 1));
    };

    const decrementDays = () => {
        const current = parseInt(dateFilterInput) || 1;
        if (current > 1) {
            setDateFilterInput(String(current - 1));
        }
    };

    // Amount filter handlers
    const handleAmountFilterClick = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        setAmountFilterAnchor(event.currentTarget);
    };

    const handleAmountFilterClose = () => {
        setAmountFilterAnchor(null);
    };

    const handleAmountFilterApply = () => {
        const amount = parseFloat(amountFilterInput);
        if (!isNaN(amount) && amount >= 0) {
            setAmountFilter(amount);
            setCurrentPage(1);
            setTransactions([]);
        }
        handleAmountFilterClose();
    };

    const handleAmountFilterClear = () => {
        setAmountFilter(null);
        setAmountFilterInput('0');
        setCurrentPage(1);
        setTransactions([]);
    };

    // Currency filter handlers
    const handleCurrencyFilterClick = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        setCurrencyFilterAnchor(event.currentTarget);
    };

    const handleCurrencyFilterClose = () => {
        setCurrencyFilterAnchor(null);
    };

    const handleCurrencyFilterApply = (currency: string) => {
        setCurrencyFilter(currency === 'all' ? null : currency);
        setCurrentPage(1);
        setTransactions([]);
        handleCurrencyFilterClose();
    };

    const handleCurrencyFilterClear = () => {
        setCurrencyFilter(null);
        setCurrentPage(1);
        setTransactions([]);
    };

    // Status filter handlers
    const handleStatusFilterClick = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        setStatusFilterAnchor(event.currentTarget);
    };

    const handleStatusFilterClose = () => {
        setStatusFilterAnchor(null);
    };

    const handleStatusFilterToggle = (status: string) => {
        setStatusFilter(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const handleStatusFilterApply = () => {
        // Note: Status filter is handled separately via selectedSummary
        // This is for additional status filtering if needed
        setCurrentPage(1);
        setTransactions([]);
        handleStatusFilterClose();
    };

    const handleStatusFilterClear = () => {
        setStatusFilter([]);
        setCurrentPage(1);
        setTransactions([]);
    };

    // Payment method filter handlers
    const handlePaymentMethodFilterClick = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        setPaymentMethodFilterAnchor(event.currentTarget);
    };

    const handlePaymentMethodFilterClose = () => {
        setPaymentMethodFilterAnchor(null);
    };

    const handlePaymentMethodFilterApply = () => {
        const method = paymentMethodFilterInput.trim();
        setPaymentMethodFilter(
            method === '' || method === 'all' ? null : method
        );
        setCurrentPage(1);
        setTransactions([]);
        handlePaymentMethodFilterClose();
    };

    const handlePaymentMethodFilterClear = () => {
        setPaymentMethodFilter(null);
        setPaymentMethodFilterInput('');
        setCurrentPage(1);
        setTransactions([]);
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
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <PageTitle>Payments</PageTitle>
                    <Tooltip title="Cache expires in 2 minutes. Click to refresh with latest data.">
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={clearCache}
                            sx={{ ml: 2 }}
                            color={
                                cacheStatus === 'cached' ? 'success' : 'primary'
                            }
                        >
                            {cacheStatus === 'cached'
                                ? '🔄 Cached'
                                : 'Clear Cache'}
                        </Button>
                    </Tooltip>
                </Box>
            </HeaderSection>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Date Filter Popover */}
            <Popover
                open={Boolean(dateFilterAnchor)}
                anchorEl={dateFilterAnchor}
                onClose={handleDateFilterClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                PaperProps={{
                    sx: {
                        p: 3,
                        minWidth: 300,
                        borderRadius: 2,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    },
                }}
            >
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Filter by: date and time
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <Typography
                        variant="body2"
                        sx={{ mb: 1, color: '#6b7280' }}
                    >
                        is in the last
                    </Typography>
                    <TextField
                        type="number"
                        value={dateFilterInput}
                        onChange={e => setDateFilterInput(e.target.value)}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                        }}
                                    >
                                        <IconButton
                                            size="small"
                                            onClick={incrementDays}
                                            sx={{
                                                height: 16,
                                                width: 16,
                                                mb: 0.5,
                                            }}
                                        >
                                            <KeyboardArrowUp fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={decrementDays}
                                            sx={{ height: 16, width: 16 }}
                                        >
                                            <KeyboardArrowDown fontSize="small" />
                                        </IconButton>
                                    </Box>
                                </InputAdornment>
                            ),
                        }}
                        sx={{ width: '100%' }}
                    />
                    <Typography
                        variant="body2"
                        sx={{ mt: 1, color: '#6b7280' }}
                    >
                        days
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={handleDateFilterApply}
                    sx={{
                        backgroundColor: '#7c3aed',
                        '&:hover': { backgroundColor: '#6d28d9' },
                        textTransform: 'none',
                        py: 1.5,
                    }}
                >
                    Apply
                </Button>
            </Popover>

            {/* Amount Filter Popover */}
            <Popover
                open={Boolean(amountFilterAnchor)}
                anchorEl={amountFilterAnchor}
                onClose={handleAmountFilterClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                PaperProps={{
                    sx: {
                        p: 3,
                        minWidth: 300,
                        borderRadius: 2,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    },
                }}
            >
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Filter by: amount
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <Select
                            value={amountOperator}
                            onChange={e => setAmountOperator(e.target.value)}
                            displayEmpty
                        >
                            <MenuItem value="eq">is equal to</MenuItem>
                            <MenuItem value="gt">is greater than</MenuItem>
                            <MenuItem value="lt">is less than</MenuItem>
                            <MenuItem value="gte">
                                is greater than or equal to
                            </MenuItem>
                            <MenuItem value="lte">
                                is less than or equal to
                            </MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        type="number"
                        value={amountFilterInput}
                        onChange={e => setAmountFilterInput(e.target.value)}
                        placeholder="0.00"
                        fullWidth
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    $
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={handleAmountFilterApply}
                    sx={{
                        backgroundColor: '#7c3aed',
                        '&:hover': { backgroundColor: '#6d28d9' },
                        textTransform: 'none',
                        py: 1.5,
                    }}
                >
                    Apply
                </Button>
            </Popover>

            {/* Currency Filter Popover */}
            <Popover
                open={Boolean(currencyFilterAnchor)}
                anchorEl={currencyFilterAnchor}
                onClose={handleCurrencyFilterClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                PaperProps={{
                    sx: {
                        p: 3,
                        minWidth: 300,
                        borderRadius: 2,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    },
                }}
            >
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Filter by: currency
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <FormControl fullWidth>
                        <Select
                            value={currencyFilter || 'all'}
                            onChange={e =>
                                handleCurrencyFilterApply(e.target.value)
                            }
                            displayEmpty
                        >
                            <MenuItem value="all">All currencies</MenuItem>
                            <MenuItem value="usd">USD</MenuItem>
                            <MenuItem value="eur">EUR</MenuItem>
                            <MenuItem value="gbp">GBP</MenuItem>
                            <MenuItem value="cad">CAD</MenuItem>
                            <MenuItem value="aud">AUD</MenuItem>
                            <MenuItem value="jpy">JPY</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Popover>

            {/* Status Filter Popover */}
            <Popover
                open={Boolean(statusFilterAnchor)}
                anchorEl={statusFilterAnchor}
                onClose={handleStatusFilterClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                PaperProps={{
                    sx: {
                        p: 3,
                        minWidth: 300,
                        maxHeight: 400,
                        borderRadius: 2,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        overflow: 'auto',
                    },
                }}
            >
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Filter by: status
                </Typography>
                <Box sx={{ mb: 2 }}>
                    {[
                        'succeeded',
                        'pending',
                        'failed',
                        'canceled',
                        'refunded',
                        'requires_payment_method',
                        'requires_confirmation',
                        'requires_action',
                    ].map(status => (
                        <Box
                            key={status}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                py: 1,
                                cursor: 'pointer',
                            }}
                            onClick={() => handleStatusFilterToggle(status)}
                        >
                            <Checkbox
                                checked={statusFilter.includes(status)}
                                onChange={() =>
                                    handleStatusFilterToggle(status)
                                }
                            />
                            <Typography
                                variant="body2"
                                sx={{ textTransform: 'capitalize' }}
                            >
                                {status.replace(/_/g, ' ')}
                            </Typography>
                        </Box>
                    ))}
                </Box>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={handleStatusFilterApply}
                    sx={{
                        backgroundColor: '#7c3aed',
                        '&:hover': { backgroundColor: '#6d28d9' },
                        textTransform: 'none',
                        py: 1.5,
                    }}
                >
                    Apply
                </Button>
            </Popover>

            {/* Payment Method Filter Popover */}
            <Popover
                open={Boolean(paymentMethodFilterAnchor)}
                anchorEl={paymentMethodFilterAnchor}
                onClose={handlePaymentMethodFilterClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                PaperProps={{
                    sx: {
                        p: 3,
                        minWidth: 300,
                        borderRadius: 2,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    },
                }}
            >
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Filter by: payment method
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <TextField
                        value={paymentMethodFilterInput}
                        onChange={e =>
                            setPaymentMethodFilterInput(e.target.value)
                        }
                        placeholder="Card"
                        fullWidth
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <ArrowDropDown />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <Typography
                        variant="body2"
                        sx={{ mt: 1, color: '#6b7280' }}
                    >
                        Common: card, bank_account, us_bank_account
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={handlePaymentMethodFilterApply}
                    sx={{
                        backgroundColor: '#7c3aed',
                        '&:hover': { backgroundColor: '#6d28d9' },
                        textTransform: 'none',
                        py: 1.5,
                    }}
                >
                    Apply
                </Button>
            </Popover>

            {/* Summary Cards - Match Stripe Dashboard: All, Succeeded, Refunded, Disputed, Failed, Uncaptured */}
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
                            selectedSummary === 'refunded' ? 'selected' : ''
                        }
                        onClick={() => handleSummaryClick('refunded')}
                        sx={{ cursor: 'pointer' }}
                    >
                        <SummaryCardContent>
                            <SummaryNumber>{summary.refunded}</SummaryNumber>
                            <SummaryLabel>Refunded</SummaryLabel>
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

            {/* Filter Bar - Below Statistics Cards */}
            <Box
                sx={{
                    px: 2,
                    mb: 2,
                    display: 'flex',
                    gap: 1,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                }}
            >
                <Button
                    variant={dateFilterDays ? 'contained' : 'outlined'}
                    size="small"
                    onClick={handleDateFilterClick}
                    startIcon={<Add />}
                    sx={{
                        textTransform: 'none',
                        borderRadius: 1,
                        borderColor: dateFilterDays ? '#7c3aed' : '#e2e8f0',
                        ...(dateFilterDays && {
                            backgroundColor: '#7c3aed',
                            '&:hover': { backgroundColor: '#6d28d9' },
                        }),
                    }}
                >
                    Date and time
                </Button>
                {dateFilterDays && (
                    <Chip
                        label={`Last ${dateFilterDays} day${dateFilterDays !== 1 ? 's' : ''}`}
                        onDelete={handleDateFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}

                <Button
                    variant={amountFilter !== null ? 'contained' : 'outlined'}
                    size="small"
                    onClick={handleAmountFilterClick}
                    startIcon={<Add />}
                    sx={{
                        textTransform: 'none',
                        borderRadius: 1,
                        borderColor:
                            amountFilter !== null ? '#7c3aed' : '#e2e8f0',
                        ...(amountFilter !== null && {
                            backgroundColor: '#7c3aed',
                            '&:hover': { backgroundColor: '#6d28d9' },
                        }),
                    }}
                >
                    Amount
                </Button>
                {amountFilter !== null && (
                    <Chip
                        label={`${amountOperator === 'eq' ? '=' : amountOperator === 'gt' ? '>' : amountOperator === 'lt' ? '<' : amountOperator === 'gte' ? '>=' : '<='} $${amountFilter.toFixed(2)}`}
                        onDelete={handleAmountFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}

                <Button
                    variant={currencyFilter ? 'contained' : 'outlined'}
                    size="small"
                    onClick={handleCurrencyFilterClick}
                    startIcon={<Add />}
                    sx={{
                        textTransform: 'none',
                        borderRadius: 1,
                        borderColor: currencyFilter ? '#7c3aed' : '#e2e8f0',
                        ...(currencyFilter && {
                            backgroundColor: '#7c3aed',
                            '&:hover': { backgroundColor: '#6d28d9' },
                        }),
                    }}
                >
                    Currency
                </Button>
                {currencyFilter && (
                    <Chip
                        label={currencyFilter.toUpperCase()}
                        onDelete={handleCurrencyFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}

                <Button
                    variant={statusFilter.length > 0 ? 'contained' : 'outlined'}
                    size="small"
                    onClick={handleStatusFilterClick}
                    startIcon={<Add />}
                    sx={{
                        textTransform: 'none',
                        borderRadius: 1,
                        borderColor:
                            statusFilter.length > 0 ? '#7c3aed' : '#e2e8f0',
                        ...(statusFilter.length > 0 && {
                            backgroundColor: '#7c3aed',
                            '&:hover': { backgroundColor: '#6d28d9' },
                        }),
                    }}
                >
                    Status
                </Button>
                {statusFilter.length > 0 && (
                    <Chip
                        label={`${statusFilter.length} selected`}
                        onDelete={handleStatusFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}

                <Button
                    variant={paymentMethodFilter ? 'contained' : 'outlined'}
                    size="small"
                    onClick={handlePaymentMethodFilterClick}
                    startIcon={<Add />}
                    sx={{
                        textTransform: 'none',
                        borderRadius: 1,
                        borderColor: paymentMethodFilter
                            ? '#7c3aed'
                            : '#e2e8f0',
                        ...(paymentMethodFilter && {
                            backgroundColor: '#7c3aed',
                            '&:hover': { backgroundColor: '#6d28d9' },
                        }),
                    }}
                >
                    Payment method
                </Button>
                {paymentMethodFilter && (
                    <Chip
                        label={paymentMethodFilter}
                        onDelete={handlePaymentMethodFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}
            </Box>

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
