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
    Popover,
    TextField,
    IconButton,
    InputAdornment,
    MenuItem,
    Select,
    FormControl,
} from '@mui/material';
import {
    CheckCircle,
    Error,
    Refresh,
    Add,
    KeyboardArrowUp,
    KeyboardArrowDown,
    ArrowDropDown,
} from '@mui/icons-material';
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
    const [allCustomers, setAllCustomers] = useState<StripeCustomer[]>([]); // Store all customers for filtering
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

    // Filter states
    const [emailFilter, setEmailFilter] = useState<string | null>(null);
    const [emailFilterAnchor, setEmailFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [emailFilterInput, setEmailFilterInput] = useState<string>('');

    const [cardFilter, setCardFilter] = useState<string | null>(null);
    const [cardFilterAnchor, setCardFilterAnchor] =
        useState<HTMLButtonElement | null>(null);

    const [dateFilterDays, setDateFilterDays] = useState<number | null>(null);
    const [dateFilterAnchor, setDateFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [dateFilterInput, setDateFilterInput] = useState<string>('1');

    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [typeFilterAnchor, setTypeFilterAnchor] =
        useState<HTMLButtonElement | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await stripeService.getAllCustomersFast({
                limit: 50,
                page: currentPage,
            });

            if (response.success) {
                // Store all customers for client-side filtering
                setAllCustomers(response.data.customers.data);

                // Apply all filters
                let filtered = response.data.customers.data;

                // Apply summary filter
                if (selectedSummary !== 'all') {
                    filtered = filtered.filter(customer => {
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

                // Apply email filter
                if (emailFilter) {
                    filtered = filtered.filter(customer =>
                        customer.email
                            ?.toLowerCase()
                            .includes(emailFilter.toLowerCase())
                    );
                }

                // Apply card filter
                if (cardFilter === 'has_card') {
                    filtered = filtered.filter(
                        customer =>
                            customer.default_source ||
                            customer.invoice_settings?.default_payment_method
                    );
                } else if (cardFilter === 'no_card') {
                    filtered = filtered.filter(
                        customer =>
                            !customer.default_source &&
                            !customer.invoice_settings?.default_payment_method
                    );
                }

                // Apply date filter
                if (dateFilterDays) {
                    const cutoffDate =
                        Date.now() / 1000 - dateFilterDays * 24 * 60 * 60;
                    filtered = filtered.filter(
                        customer => customer.created >= cutoffDate
                    );
                }

                // Apply type filter
                if (typeFilter === 'customer_account') {
                    filtered = filtered.filter(customer => customer.email);
                } else if (typeFilter === 'guest') {
                    filtered = filtered.filter(customer => !customer.email);
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
    }, [
        currentPage,
        selectedSummary,
        emailFilter,
        cardFilter,
        dateFilterDays,
        typeFilter,
    ]);

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

    // Email filter handlers
    const handleEmailFilterClick = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        setEmailFilterAnchor(event.currentTarget);
    };

    const handleEmailFilterClose = () => {
        setEmailFilterAnchor(null);
    };

    const handleEmailFilterApply = () => {
        const email = emailFilterInput.trim();
        setEmailFilter(email === '' ? null : email);
        setCurrentPage(1);
        setCustomers([]);
        handleEmailFilterClose();
    };

    const handleEmailFilterClear = () => {
        setEmailFilter(null);
        setEmailFilterInput('');
        setCurrentPage(1);
        setCustomers([]);
    };

    // Card filter handlers
    const handleCardFilterClick = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        setCardFilterAnchor(event.currentTarget);
    };

    const handleCardFilterClose = () => {
        setCardFilterAnchor(null);
    };

    const handleCardFilterApply = (value: string) => {
        setCardFilter(value === 'all' ? null : value);
        setCurrentPage(1);
        setCustomers([]);
        handleCardFilterClose();
    };

    const handleCardFilterClear = () => {
        setCardFilter(null);
        setCurrentPage(1);
        setCustomers([]);
    };

    // Date filter handlers
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
            setCustomers([]);
        }
        handleDateFilterClose();
    };

    const handleDateFilterClear = () => {
        setDateFilterDays(null);
        setDateFilterInput('1');
        setCurrentPage(1);
        setCustomers([]);
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

    // Type filter handlers
    const handleTypeFilterClick = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        setTypeFilterAnchor(event.currentTarget);
    };

    const handleTypeFilterClose = () => {
        setTypeFilterAnchor(null);
    };

    const handleTypeFilterApply = (value: string) => {
        setTypeFilter(value === 'all' ? null : value);
        setCurrentPage(1);
        setCustomers([]);
        handleTypeFilterClose();
    };

    const handleTypeFilterClear = () => {
        setTypeFilter(null);
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

            {/* Email Filter Popover */}
            <Popover
                open={Boolean(emailFilterAnchor)}
                anchorEl={emailFilterAnchor}
                onClose={handleEmailFilterClose}
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
                        mt: 0.5, // Small gap below button
                    },
                }}
            >
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Filter by: email
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <Typography
                        variant="body2"
                        sx={{ mb: 1, color: '#6b7280' }}
                    >
                        is equal to
                    </Typography>
                    <TextField
                        value={emailFilterInput}
                        onChange={e => setEmailFilterInput(e.target.value)}
                        placeholder="email@example.com"
                        fullWidth
                    />
                </Box>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={handleEmailFilterApply}
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

            {/* Card Filter Popover */}
            <Popover
                open={Boolean(cardFilterAnchor)}
                anchorEl={cardFilterAnchor}
                onClose={handleCardFilterClose}
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
                        mt: 0.5, // Small gap below button
                    },
                }}
            >
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Filter by: card
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <FormControl fullWidth>
                        <Select
                            value={cardFilter || 'all'}
                            onChange={e =>
                                handleCardFilterApply(e.target.value)
                            }
                            displayEmpty
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="has_card">
                                has an active card
                            </MenuItem>
                            <MenuItem value="no_card">
                                does not have an active card
                            </MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Popover>

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
                        mt: 0.5, // Small gap below button
                    },
                }}
            >
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Filter by: created date
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

            {/* Type Filter Popover */}
            <Popover
                open={Boolean(typeFilterAnchor)}
                anchorEl={typeFilterAnchor}
                onClose={handleTypeFilterClose}
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
                        mt: 0.5, // Small gap below button
                    },
                }}
            >
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Filter by: type
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <FormControl fullWidth>
                        <Select
                            value={typeFilter || 'all'}
                            onChange={e =>
                                handleTypeFilterApply(e.target.value)
                            }
                            displayEmpty
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="customer_account">
                                Customer account
                            </MenuItem>
                            <MenuItem value="guest">Guest</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Popover>

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
                    variant={emailFilter ? 'contained' : 'outlined'}
                    size="small"
                    onClick={handleEmailFilterClick}
                    startIcon={<Add />}
                    sx={{
                        textTransform: 'none',
                        borderRadius: 1,
                        borderColor: emailFilter ? '#7c3aed' : '#e2e8f0',
                        ...(emailFilter && {
                            backgroundColor: '#7c3aed',
                            '&:hover': { backgroundColor: '#6d28d9' },
                        }),
                    }}
                >
                    Email
                </Button>
                {emailFilter && (
                    <Chip
                        label={emailFilter}
                        onDelete={handleEmailFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}

                <Button
                    variant={cardFilter ? 'contained' : 'outlined'}
                    size="small"
                    onClick={handleCardFilterClick}
                    startIcon={<Add />}
                    sx={{
                        textTransform: 'none',
                        borderRadius: 1,
                        borderColor: cardFilter ? '#7c3aed' : '#e2e8f0',
                        ...(cardFilter && {
                            backgroundColor: '#7c3aed',
                            '&:hover': { backgroundColor: '#6d28d9' },
                        }),
                    }}
                >
                    Card
                </Button>
                {cardFilter && (
                    <Chip
                        label={
                            cardFilter === 'has_card'
                                ? 'Has active card'
                                : 'No active card'
                        }
                        onDelete={handleCardFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}

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
                    Created date
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
                    variant={typeFilter ? 'contained' : 'outlined'}
                    size="small"
                    onClick={handleTypeFilterClick}
                    startIcon={<Add />}
                    sx={{
                        textTransform: 'none',
                        borderRadius: 1,
                        borderColor: typeFilter ? '#7c3aed' : '#e2e8f0',
                        ...(typeFilter && {
                            backgroundColor: '#7c3aed',
                            '&:hover': { backgroundColor: '#6d28d9' },
                        }),
                    }}
                >
                    Type
                </Button>
                {typeFilter && (
                    <Chip
                        label={
                            typeFilter === 'customer_account'
                                ? 'Customer account'
                                : 'Guest'
                        }
                        onDelete={handleTypeFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}
            </Box>

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
