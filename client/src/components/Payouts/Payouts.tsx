import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    MenuItem,
    Select,
    FormControl,
    Checkbox,
} from '@mui/material';
import {
    CheckCircle,
    Schedule,
    Error,
    Cancel,
    LocalShipping,
    Add,
    KeyboardArrowUp,
    KeyboardArrowDown,
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

    // Filter states
    const [dateFilterDays, setDateFilterDays] = useState<number | null>(null);
    const [dateFilterAnchor, setDateFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [dateFilterInput, setDateFilterInput] = useState<string>('1');

    const [amountFilter, setAmountFilter] = useState<number | null>(null);
    const [amountOperator, setAmountOperator] = useState<string>('eq');
    const [amountFilterAnchor, setAmountFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [amountFilterInput, setAmountFilterInput] = useState<string>('0');
    // Temporary state for popover inputs (doesn't trigger API calls)
    const [tempAmountOperator, setTempAmountOperator] = useState<string>('eq');

    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [statusFilterAnchor, setStatusFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const statusFilterButtonRef = useRef<HTMLButtonElement | null>(null);
    // Temporary state for popover checkbox selections (doesn't trigger API calls)
    const [tempStatusFilter, setTempStatusFilter] = useState<string[]>([]);

    // Refs for Popover containers to fix Select menu positioning
    const amountFilterPopoverRef = useRef<HTMLElement>(null);

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
                // Apply all filters
                let filtered = response.data.payouts.data;

                // Apply summary filter (if not using status filter)
                if (selectedSummary !== 'all' && statusFilter.length === 0) {
                    filtered = filtered.filter(payout => {
                        return payout.status === selectedSummary;
                    });
                }

                // Apply status filter (if multiple statuses selected)
                if (statusFilter.length > 0) {
                    filtered = filtered.filter(payout =>
                        statusFilter.includes(payout.status)
                    );
                }

                // Apply date filter
                if (dateFilterDays) {
                    const cutoffDate =
                        Date.now() / 1000 - dateFilterDays * 24 * 60 * 60;
                    filtered = filtered.filter(
                        payout => payout.created >= cutoffDate
                    );
                }

                // Apply amount filter
                if (amountFilter !== null) {
                    filtered = filtered.filter(payout => {
                        const payoutAmount = payout.amount / 100; // Convert from cents
                        switch (amountOperator) {
                            case 'eq':
                                return payoutAmount === amountFilter;
                            case 'gt':
                                return payoutAmount > amountFilter;
                            case 'lt':
                                return payoutAmount < amountFilter;
                            case 'gte':
                                return payoutAmount >= amountFilter;
                            case 'lte':
                                return payoutAmount <= amountFilter;
                            default:
                                return true;
                        }
                    });
                }

                setPayouts(filtered);
                setHasMore(response.data.payouts.has_more);
                setSummary(response.data.summary);
                console.log(
                    `Payouts: Received ${response.data.payouts.data.length} payouts, filtered to ${filtered.length}, total: ${response.data.payouts.total_count}, has_more: ${response.data.payouts.has_more}`
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
        statusFilter,
    ]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
        // Clear status filter when clicking summary card
        if (type !== 'all') {
            setStatusFilter([]);
        }
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
        handleDateFilterClose(); // Close popover first
        const days = parseInt(dateFilterInput);
        if (days > 0) {
            // Use setTimeout to ensure popover closes before layout shift
            setTimeout(() => {
                setDateFilterDays(days);
                setCurrentPage(1);
                setPayouts([]);
            }, 0);
        }
    };

    const handleDateFilterClear = () => {
        setDateFilterDays(null);
        setDateFilterInput('1');
        setCurrentPage(1);
        setPayouts([]);
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
        // Initialize temp state with current values when opening
        setTempAmountOperator(amountOperator);
        setAmountFilterAnchor(event.currentTarget);
    };

    const handleAmountFilterClose = () => {
        setAmountFilterAnchor(null);
    };

    const handleAmountFilterApply = () => {
        handleAmountFilterClose(); // Close popover first
        const amount = parseFloat(amountFilterInput);
        if (!isNaN(amount) && amount >= 0) {
            // Use setTimeout to ensure popover closes before layout shift
            setTimeout(() => {
                setAmountFilter(amount);
                setAmountOperator(tempAmountOperator); // Apply temp state to actual state
                setCurrentPage(1);
                setPayouts([]);
            }, 0);
        }
    };

    const handleAmountFilterClear = () => {
        setAmountFilter(null);
        setAmountOperator('eq');
        setAmountFilterInput('0');
        setCurrentPage(1);
        setPayouts([]);
    };

    // Status filter handlers
    const handleStatusFilterClick = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        const button = event.currentTarget;
        statusFilterButtonRef.current = button;
        // Initialize temp state with current values when opening
        setTempStatusFilter([...statusFilter]);
        setStatusFilterAnchor(button);
    };

    const handleStatusFilterClose = () => {
        setStatusFilterAnchor(null);
    };

    const handleStatusFilterToggle = (status: string) => {
        // Update temp state only (doesn't trigger API calls)
        setTempStatusFilter(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const handleStatusFilterApply = () => {
        handleStatusFilterClose(); // Close popover first
        // Use setTimeout to ensure popover closes before layout shift
        setTimeout(() => {
            // Apply temp state to actual state (triggers API call)
            setStatusFilter([...tempStatusFilter]);
            // Clear selectedSummary when using status filter
            if (tempStatusFilter.length > 0) {
                setSelectedSummary('all');
            }
            setCurrentPage(1);
            setPayouts([]);
        }, 0);
    };

    const handleStatusFilterClear = () => {
        setStatusFilter([]);
        setTempStatusFilter([]);
        setCurrentPage(1);
        setPayouts([]);
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
                anchorReference="anchorEl"
                disableAutoFocus
                disableEnforceFocus
                disableRestoreFocus
                disableScrollLock
                slotProps={{
                    paper: {
                        sx: {
                            p: 3,
                            minWidth: 300,
                            borderRadius: 2,
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            mt: 0.5, // Small gap below button
                        },
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
                anchorReference="anchorEl"
                disableAutoFocus
                disableEnforceFocus
                disableRestoreFocus
                disableScrollLock
                disablePortal
                slotProps={{
                    paper: {
                        sx: {
                            p: 3,
                            minWidth: 300,
                            borderRadius: 2,
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            mt: 0.5, // Small gap below button
                        },
                        ref: (el: HTMLElement | null) => {
                            if (el) amountFilterPopoverRef.current = el;
                        },
                        onMouseDown: e => e.stopPropagation(),
                    },
                }}
                modifiers={[
                    {
                        name: 'preventOverflow',
                        enabled: false,
                    },
                    {
                        name: 'flip',
                        enabled: false,
                    },
                    {
                        name: 'offset',
                        enabled: true,
                        options: {
                            offset: [0, 4],
                        },
                    },
                ]}
            >
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Filter by: amount
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <Select
                            value={tempAmountOperator}
                            onChange={e =>
                                setTempAmountOperator(e.target.value)
                            }
                            displayEmpty
                            onOpen={e => e.stopPropagation()}
                            onClose={e => e.stopPropagation()}
                            MenuProps={{
                                container:
                                    amountFilterPopoverRef.current ||
                                    document.body,
                                disablePortal: true,
                                disableScrollLock: true,
                                disableAutoFocusItem: true,
                                anchorOrigin: {
                                    vertical: 'bottom',
                                    horizontal: 'left',
                                },
                                transformOrigin: {
                                    vertical: 'top',
                                    horizontal: 'left',
                                },
                                PaperProps: {
                                    sx: {
                                        maxHeight: 300,
                                    },
                                    onMouseDown: e => e.stopPropagation(),
                                },
                                modifiers: [
                                    {
                                        name: 'preventOverflow',
                                        enabled: false,
                                    },
                                    {
                                        name: 'flip',
                                        enabled: false,
                                    },
                                ],
                            }}
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

            {/* Status Filter Popover */}
            <Popover
                open={Boolean(statusFilterAnchor)}
                anchorEl={
                    statusFilterAnchor ||
                    statusFilterButtonRef.current ||
                    undefined
                }
                onClose={handleStatusFilterClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                anchorReference="anchorEl"
                disableAutoFocus
                disableEnforceFocus
                disableRestoreFocus
                disableScrollLock
                disablePortal
                slotProps={{
                    paper: {
                        sx: {
                            p: 3,
                            minWidth: 300,
                            maxHeight: 400,
                            borderRadius: 2,
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            overflow: 'auto',
                            mt: 0.5, // Small gap below button
                        },
                        onMouseDown: e => e.stopPropagation(),
                    },
                }}
                modifiers={[
                    {
                        name: 'preventOverflow',
                        enabled: false,
                    },
                    {
                        name: 'flip',
                        enabled: false,
                    },
                    {
                        name: 'offset',
                        enabled: true,
                        options: {
                            offset: [0, 4],
                        },
                    },
                ]}
            >
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Filter by: status
                </Typography>
                <Box sx={{ mb: 2 }}>
                    {[
                        'paid',
                        'pending',
                        'in_transit',
                        'failed',
                        'canceled',
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
                                checked={tempStatusFilter.includes(status)}
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
                    ref={statusFilterButtonRef}
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
            </Box>

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
