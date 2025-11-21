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
    '& .MuiTableCell-root:nth-of-type(10)': { minWidth: '150px' }, // Customer Email
    '& .MuiTableCell-root:nth-of-type(11)': { minWidth: '150px' }, // Customer ID
    '& .MuiTableCell-root:nth-of-type(12)': { minWidth: '150px' }, // Account
    '& .MuiTableCell-root:nth-of-type(13)': { minWidth: '140px' }, // Date
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
    const [dateFilterType, setDateFilterType] = useState<string>('in_last');
    const [dateFilterAnchor, setDateFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [dateFilterInput, setDateFilterInput] = useState<string>('1');
    const [dateFilterInput2, setDateFilterInput2] = useState<string>('');
    // Temporary state for popover (doesn't trigger API calls)
    const [tempDateFilterType, setTempDateFilterType] =
        useState<string>('in_last');
    const [tempDateFilterInput, setTempDateFilterInput] = useState<string>('1');
    const [tempDateFilterInput2, setTempDateFilterInput2] =
        useState<string>('');

    // New filter states
    const [amountFilter, setAmountFilter] = useState<number | null>(null);
    const [amountOperator, setAmountOperator] = useState<string>('eq');
    const [amountFilterAnchor, setAmountFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [amountFilterInput, setAmountFilterInput] = useState<string>('0');
    // Temporary state for popover inputs (doesn't trigger API calls)
    const [tempAmountOperator, setTempAmountOperator] = useState<string>('eq');

    const [currencyFilter, setCurrencyFilter] = useState<string | null>(null);
    const [currencyFilterAnchor, setCurrencyFilterAnchor] =
        useState<HTMLButtonElement | null>(null);

    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [statusFilterAnchor, setStatusFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    // Temporary state for popover checkbox selections (doesn't trigger API calls)
    const [tempStatusFilter, setTempStatusFilter] = useState<string[]>([]);

    const [paymentMethodFilter, setPaymentMethodFilter] = useState<
        string | null
    >(null);
    const [paymentMethodFilterLabel, setPaymentMethodFilterLabel] = useState<
        string | null
    >(null);
    const [paymentMethodFilterAnchor, setPaymentMethodFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [paymentMethodFilterInput, setPaymentMethodFilterInput] =
        useState<string>('');

    // Payment method options mapping (display name -> Stripe payment method type)
    const paymentMethodOptions = [
        { label: '3D Secure', value: 'card' },
        { label: '3D Secure 2', value: 'card' },
        { label: 'ACH Credit Transfer', value: 'ach_credit_transfer' },
        { label: 'ACH Direct Debit', value: 'ach_debit' },
        { label: 'Affirm', value: 'affirm' },
        { label: 'Afterpay / Clearpay', value: 'afterpay_clearpay' },
        { label: 'Alipay', value: 'alipay' },
        { label: 'Amazon Pay', value: 'amazon_pay' },
        { label: 'Amex Express Checkout', value: 'card' },
        { label: 'Apple Pay', value: 'card' },
        { label: 'Australia BECS Direct Debit', value: 'au_becs_debit' },
        { label: 'Bancontact', value: 'bancontact' },
        { label: 'Bank transfer', value: 'us_bank_account' },
        { label: 'Canadian pre-authorized debits', value: 'acss_debit' },
        { label: 'Card', value: 'card' },
        { label: 'Card Present', value: 'card' },
        { label: 'Cash App Pay', value: 'cashapp' },
        { label: 'EPS', value: 'eps' },
        { label: 'giropay', value: 'giropay' },
        { label: 'Google Pay', value: 'card' },
        { label: 'iDEAL', value: 'ideal' },
        { label: 'Interac', value: 'interac_present' },
        { label: 'Kakao Pay', value: 'kakao_pay' },
        { label: 'Klarna', value: 'klarna' },
        { label: 'Korean cards', value: 'card' },
        { label: 'Link', value: 'link' },
        { label: 'Masterpass', value: 'card' },
        { label: 'MB WAY', value: 'mbway' },
        { label: 'Meta Pay', value: 'card' },
        { label: 'MobilePay', value: 'mobilepay' },
        { label: 'Multibanco', value: 'multibanco' },
        { label: 'Naver Pay', value: 'naver_pay' },
        { label: 'P24', value: 'p24' },
        { label: 'PAYCO', value: 'payco' },
        { label: 'PayPal', value: 'paypal' },
        { label: 'Pix', value: 'pix' },
        { label: 'Samsung Pay', value: 'card' },
        { label: 'SEPA Direct Debit', value: 'sepa_debit' },
        { label: 'Sofort', value: 'sofort' },
        { label: 'Stablecoins and Crypto', value: 'us_bank_account' },
        { label: 'Stripe balance', value: 'customer_balance' },
        { label: 'Visa Checkout', value: 'card' },
        { label: 'WeChat Pay', value: 'wechat_pay' },
        { label: 'Zip', value: 'zip' },
    ];

    // More filters states
    const [moreFiltersAnchor, setMoreFiltersAnchor] =
        useState<HTMLButtonElement | null>(null);

    const [customerIdFilter, setCustomerIdFilter] = useState<string | null>(
        null
    );
    const [customerIdFilterAnchor, setCustomerIdFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [customerIdFilterInput, setCustomerIdFilterInput] =
        useState<string>('');

    const [emailFilter, setEmailFilter] = useState<string | null>(null);
    const [emailFilterAnchor, setEmailFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [emailFilterInput, setEmailFilterInput] = useState<string>('');

    const [disputeAmountFilter, setDisputeAmountFilter] = useState<
        number | null
    >(null);
    const [disputeAmountOperator, setDisputeAmountOperator] =
        useState<string>('eq');
    const [disputeAmountFilterAnchor, setDisputeAmountFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [disputeAmountFilterInput, setDisputeAmountFilterInput] =
        useState<string>('0');
    // Temporary state for popover inputs (doesn't trigger API calls)
    const [tempDisputeAmountOperator, setTempDisputeAmountOperator] =
        useState<string>('eq');

    // Refs for Popover containers to fix Select menu positioning
    const dateFilterPopoverRef = useRef<HTMLElement>(null);
    const amountFilterPopoverRef = useRef<HTMLElement>(null);
    const currencyFilterPopoverRef = useRef<HTMLElement>(null);
    const paymentMethodFilterPopoverRef = useRef<HTMLElement>(null);
    const disputeAmountFilterPopoverRef = useRef<HTMLElement>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch platform transactions only
            // Use statusFilter if it has values, otherwise use selectedSummary
            const requestParams = {
                limit: 50, // Smaller batches for faster loading
                page: currentPage,
                status:
                    statusFilter.length === 0 && selectedSummary !== 'all'
                        ? selectedSummary
                        : undefined,
                statusFilter:
                    statusFilter.length > 0 ? statusFilter : undefined,
                days: dateFilterDays || undefined,
                amount: amountFilter !== null ? amountFilter : undefined,
                amountOperator:
                    amountFilter !== null ? amountOperator : undefined,
                currency: currencyFilter || undefined,
                paymentMethod: paymentMethodFilter || undefined,
            };

            const response =
                await stripeService.getAllTransactionsFast(requestParams);

            if (response.success) {
                // Apply client-side filters for customer ID, email, and dispute amount
                let filteredTransactions = response.data.transactions.data;

                // Apply customer ID filter
                if (customerIdFilter) {
                    filteredTransactions = filteredTransactions.filter(
                        (transaction: StripeTransaction) =>
                            transaction.customer?.id
                                ?.toLowerCase()
                                .includes(customerIdFilter.toLowerCase())
                    );
                }

                // Apply email filter
                if (emailFilter) {
                    filteredTransactions = filteredTransactions.filter(
                        (transaction: StripeTransaction) =>
                            transaction.customer?.email
                                ?.toLowerCase()
                                .includes(emailFilter.toLowerCase())
                    );
                }

                // Apply date filter
                if (dateFilterType === 'in_last' && dateFilterDays) {
                    const cutoffDate =
                        Date.now() / 1000 - dateFilterDays * 24 * 60 * 60;
                    filteredTransactions = filteredTransactions.filter(
                        (transaction: StripeTransaction) =>
                            transaction.created >= cutoffDate
                    );
                } else if (dateFilterType !== 'in_last' && dateFilterInput) {
                    // Convert date string to Unix timestamp (start of day in UTC)
                    const filterDate = new Date(dateFilterInput);
                    filterDate.setHours(0, 0, 0, 0);
                    const filterTimestamp = Math.floor(
                        filterDate.getTime() / 1000
                    );

                    // End of day timestamp for "equal to" and "before or on"
                    const filterDateEnd = new Date(dateFilterInput);
                    filterDateEnd.setHours(23, 59, 59, 999);
                    const filterTimestampEnd = Math.floor(
                        filterDateEnd.getTime() / 1000
                    );

                    filteredTransactions = filteredTransactions.filter(
                        (transaction: StripeTransaction) => {
                            const transactionDate = transaction.created;
                            switch (dateFilterType) {
                                case 'equal_to':
                                    return (
                                        transactionDate >= filterTimestamp &&
                                        transactionDate <= filterTimestampEnd
                                    );
                                case 'on_or_after':
                                    return transactionDate >= filterTimestamp;
                                case 'before_or_on':
                                    return (
                                        transactionDate <= filterTimestampEnd
                                    );
                                case 'between':
                                    if (dateFilterInput2) {
                                        const filterDate2 = new Date(
                                            dateFilterInput2
                                        );
                                        filterDate2.setHours(23, 59, 59, 999);
                                        const filterTimestamp2 = Math.floor(
                                            filterDate2.getTime() / 1000
                                        );
                                        return (
                                            transactionDate >=
                                                filterTimestamp &&
                                            transactionDate <= filterTimestamp2
                                        );
                                    }
                                    return false;
                                default:
                                    return true;
                            }
                        }
                    );
                }

                // Apply dispute amount filter
                // Note: dispute_amount may not be available on all transactions
                // This filter will only match transactions that have dispute information
                if (disputeAmountFilter !== null) {
                    const disputeAmountInCents = Math.round(
                        disputeAmountFilter * 100
                    );
                    filteredTransactions = filteredTransactions.filter(
                        (transaction: StripeTransaction) => {
                            // Check if transaction has dispute amount (may need to be added to type)
                            const disputeAmount =
                                (transaction as any).dispute_amount || 0;
                            if (disputeAmount === 0) return false; // No dispute, doesn't match
                            switch (disputeAmountOperator) {
                                case 'eq':
                                    return (
                                        disputeAmount === disputeAmountInCents
                                    );
                                case 'gt':
                                    return disputeAmount > disputeAmountInCents;
                                case 'lt':
                                    return disputeAmount < disputeAmountInCents;
                                case 'gte':
                                    return (
                                        disputeAmount >= disputeAmountInCents
                                    );
                                case 'lte':
                                    return (
                                        disputeAmount <= disputeAmountInCents
                                    );
                                default:
                                    return (
                                        disputeAmount === disputeAmountInCents
                                    );
                            }
                        }
                    );
                }

                // Always replace data to avoid duplicates
                // Backend handles pagination, so we just show what it returns
                setTransactions(filteredTransactions);
                setHasMore(response.data.transactions.has_more);
                setSummary(response.data.summary);
                console.log(
                    `Payments: Received ${response.data.transactions.data.length} transactions, filtered to ${filteredTransactions.length}, total: ${response.data.transactions.total_count}, has_more: ${response.data.transactions.has_more}`
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
        statusFilter,
        dateFilterDays,
        dateFilterType,
        dateFilterInput,
        dateFilterInput2,
        amountFilter,
        amountOperator,
        currencyFilter,
        paymentMethodFilter,
        customerIdFilter,
        emailFilter,
        disputeAmountFilter,
        disputeAmountOperator,
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
        // Initialize temp state with current values when opening
        setTempDateFilterType(dateFilterType);
        setTempDateFilterInput(dateFilterInput);
        setTempDateFilterInput2(dateFilterInput2);
        setDateFilterAnchor(event.currentTarget);
    };

    const handleDateFilterClose = () => {
        setDateFilterAnchor(null);
    };

    const handleDateFilterApply = () => {
        handleDateFilterClose(); // Close popover first
        // Use setTimeout to ensure popover closes before layout shift
        setTimeout(() => {
            if (tempDateFilterType === 'in_last') {
                const days = parseInt(tempDateFilterInput);
                if (days > 0) {
                    setDateFilterDays(days);
                    setDateFilterInput(tempDateFilterInput);
                }
            } else {
                setDateFilterDays(null);
                setDateFilterInput(tempDateFilterInput);
                setDateFilterInput2(tempDateFilterInput2);
            }
            setDateFilterType(tempDateFilterType); // Apply temp state to actual state
            setCurrentPage(1);
            setTransactions([]);
        }, 0);
    };

    const handleDateFilterClear = () => {
        setDateFilterDays(null);
        setDateFilterType('in_last');
        setDateFilterInput('1');
        setDateFilterInput2('');
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
        // Initialize temp state with current values when opening
        setTempAmountOperator(amountOperator);
        setAmountFilterAnchor(event.currentTarget);
    };

    const handleAmountFilterClose = () => {
        setAmountFilterAnchor(null);
    };

    const handleAmountFilterApply = () => {
        const amount = parseFloat(amountFilterInput);
        if (!isNaN(amount) && amount >= 0) {
            setAmountFilter(amount);
            setAmountOperator(tempAmountOperator); // Apply temp state to actual state
            setCurrentPage(1);
            setTransactions([]);
        }
        handleAmountFilterClose();
    };

    const handleAmountFilterClear = () => {
        setAmountFilter(null);
        setAmountOperator('eq');
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
        // Initialize temp state with current values when opening
        setTempStatusFilter([...statusFilter]);
        setStatusFilterAnchor(event.currentTarget);
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
        // Apply temp state to actual state (triggers API call)
        setStatusFilter([...tempStatusFilter]);
        setCurrentPage(1);
        setTransactions([]);
        handleStatusFilterClose();
    };

    const handleStatusFilterClear = () => {
        setStatusFilter([]);
        setTempStatusFilter([]);
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

    const handlePaymentMethodFilterApply = (selectedLabel: string) => {
        if (selectedLabel === 'all') {
            setPaymentMethodFilter(null);
            setPaymentMethodFilterLabel(null);
            setPaymentMethodFilterInput('');
        } else {
            // Find the option by label to get the Stripe payment method type value
            const selectedOption = paymentMethodOptions.find(
                opt => opt.label === selectedLabel
            );
            if (selectedOption) {
                setPaymentMethodFilter(selectedOption.value);
                setPaymentMethodFilterLabel(selectedOption.label);
                setPaymentMethodFilterInput(selectedOption.label);
            }
        }
        setCurrentPage(1);
        setTransactions([]);
        handlePaymentMethodFilterClose();
    };

    const handlePaymentMethodFilterClear = () => {
        setPaymentMethodFilter(null);
        setPaymentMethodFilterLabel(null);
        setPaymentMethodFilterInput('');
        setCurrentPage(1);
        setTransactions([]);
    };

    // More filters handlers
    const handleMoreFiltersClick = (
        event: React.MouseEvent<HTMLButtonElement>
    ) => {
        setMoreFiltersAnchor(event.currentTarget);
    };

    const handleMoreFiltersClose = () => {
        setMoreFiltersAnchor(null);
    };

    // Customer ID filter handlers
    const handleCustomerIdFilterOpen = () => {
        // Store the anchor before closing more filters
        const anchor = moreFiltersAnchor;
        setMoreFiltersAnchor(null);
        // Use a small delay to ensure the more filters popover closes first
        setTimeout(() => {
            setCustomerIdFilterAnchor(anchor);
        }, 100);
    };

    const handleCustomerIdFilterClose = () => {
        setCustomerIdFilterAnchor(null);
    };

    const handleCustomerIdFilterApply = () => {
        const customerId = customerIdFilterInput.trim();
        setCustomerIdFilter(customerId === '' ? null : customerId);
        setCurrentPage(1);
        setTransactions([]);
        handleCustomerIdFilterClose();
    };

    const handleCustomerIdFilterClear = () => {
        setCustomerIdFilter(null);
        setCustomerIdFilterInput('');
        setCurrentPage(1);
        setTransactions([]);
    };

    // Email filter handlers
    const handleEmailFilterOpen = () => {
        // Store the anchor before closing more filters
        const anchor = moreFiltersAnchor;
        setMoreFiltersAnchor(null);
        // Use a small delay to ensure the more filters popover closes first
        setTimeout(() => {
            setEmailFilterAnchor(anchor);
        }, 100);
    };

    const handleEmailFilterClose = () => {
        setEmailFilterAnchor(null);
    };

    const handleEmailFilterApply = () => {
        const email = emailFilterInput.trim();
        setEmailFilter(email === '' ? null : email);
        setCurrentPage(1);
        setTransactions([]);
        handleEmailFilterClose();
    };

    const handleEmailFilterClear = () => {
        setEmailFilter(null);
        setEmailFilterInput('');
        setCurrentPage(1);
        setTransactions([]);
    };

    // Dispute amount filter handlers
    const handleDisputeAmountFilterOpen = () => {
        // Store the anchor before closing more filters
        const anchor = moreFiltersAnchor;
        setMoreFiltersAnchor(null);
        // Initialize temp state with current values when opening
        setTempDisputeAmountOperator(disputeAmountOperator);
        // Use a small delay to ensure the more filters popover closes first
        setTimeout(() => {
            setDisputeAmountFilterAnchor(anchor);
        }, 100);
    };

    const handleDisputeAmountFilterClose = () => {
        setDisputeAmountFilterAnchor(null);
    };

    const handleDisputeAmountFilterApply = () => {
        const amount = parseFloat(disputeAmountFilterInput);
        if (!isNaN(amount) && amount >= 0) {
            setDisputeAmountFilter(amount);
            setDisputeAmountOperator(tempDisputeAmountOperator); // Apply temp state to actual state
            setCurrentPage(1);
            setTransactions([]);
        }
        handleDisputeAmountFilterClose();
    };

    const handleDisputeAmountFilterClear = () => {
        setDisputeAmountFilter(null);
        setDisputeAmountOperator('eq');
        setDisputeAmountFilterInput('0');
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
                            if (el) dateFilterPopoverRef.current = el;
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
                    Filter by: Date
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <Select
                            value={tempDateFilterType}
                            onChange={e =>
                                setTempDateFilterType(e.target.value)
                            }
                            displayEmpty
                            onOpen={e => e.stopPropagation()}
                            onClose={e => e.stopPropagation()}
                            MenuProps={{
                                container:
                                    dateFilterPopoverRef.current ||
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
                            <MenuItem value="in_last">is in the last</MenuItem>
                            <MenuItem value="equal_to">is equal to</MenuItem>
                            <MenuItem value="between">is between</MenuItem>
                            <MenuItem value="on_or_after">
                                is on or after
                            </MenuItem>
                            <MenuItem value="before_or_on">
                                is before or on
                            </MenuItem>
                        </Select>
                    </FormControl>
                    {tempDateFilterType === 'in_last' && (
                        <>
                            <TextField
                                type="number"
                                value={tempDateFilterInput}
                                onChange={e =>
                                    setTempDateFilterInput(e.target.value)
                                }
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
                                                    onClick={() => {
                                                        const current =
                                                            parseInt(
                                                                tempDateFilterInput
                                                            ) || 1;
                                                        setTempDateFilterInput(
                                                            String(current + 1)
                                                        );
                                                    }}
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
                                                    onClick={() => {
                                                        const current =
                                                            parseInt(
                                                                tempDateFilterInput
                                                            ) || 1;
                                                        if (current > 1) {
                                                            setTempDateFilterInput(
                                                                String(
                                                                    current - 1
                                                                )
                                                            );
                                                        }
                                                    }}
                                                    sx={{
                                                        height: 16,
                                                        width: 16,
                                                    }}
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
                        </>
                    )}
                    {(tempDateFilterType === 'equal_to' ||
                        tempDateFilterType === 'on_or_after' ||
                        tempDateFilterType === 'before_or_on') && (
                        <TextField
                            type="date"
                            value={tempDateFilterInput}
                            onChange={e =>
                                setTempDateFilterInput(e.target.value)
                            }
                            fullWidth
                            InputLabelProps={{
                                shrink: true,
                            }}
                        />
                    )}
                    {tempDateFilterType === 'between' && (
                        <Box
                            sx={{
                                display: 'flex',
                                gap: 1,
                                alignItems: 'center',
                            }}
                        >
                            <TextField
                                type="date"
                                value={tempDateFilterInput}
                                onChange={e =>
                                    setTempDateFilterInput(e.target.value)
                                }
                                label="From"
                                fullWidth
                                InputLabelProps={{
                                    shrink: true,
                                }}
                            />
                            <TextField
                                type="date"
                                value={tempDateFilterInput2}
                                onChange={e =>
                                    setTempDateFilterInput2(e.target.value)
                                }
                                label="To"
                                fullWidth
                                InputLabelProps={{
                                    shrink: true,
                                }}
                            />
                        </Box>
                    )}
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
                            if (el) currencyFilterPopoverRef.current = el;
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
                            onOpen={e => e.stopPropagation()}
                            onClose={e => e.stopPropagation()}
                            MenuProps={{
                                container:
                                    currencyFilterPopoverRef.current ||
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
                            mt: 0.5, // Small gap below button
                        },
                        ref: (el: HTMLElement | null) => {
                            if (el) paymentMethodFilterPopoverRef.current = el;
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
                    Filter by: payment method
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <FormControl fullWidth>
                        <Select
                            value={paymentMethodFilterLabel || 'all'}
                            onChange={e =>
                                handlePaymentMethodFilterApply(e.target.value)
                            }
                            displayEmpty
                            renderValue={selected => {
                                if (selected === 'all' || !selected) {
                                    return 'All payment methods';
                                }
                                return selected;
                            }}
                            onOpen={e => e.stopPropagation()}
                            onClose={e => e.stopPropagation()}
                            MenuProps={{
                                container:
                                    paymentMethodFilterPopoverRef.current ||
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
                            <MenuItem value="all">All payment methods</MenuItem>
                            {paymentMethodOptions.map(option => (
                                <MenuItem
                                    key={option.label}
                                    value={option.label}
                                >
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            </Popover>

            {/* More Filters Popover */}
            <Popover
                open={Boolean(moreFiltersAnchor)}
                anchorEl={moreFiltersAnchor}
                onClose={handleMoreFiltersClose}
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
                            p: 2,
                            minWidth: 280,
                            borderRadius: 2,
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            mt: 0.5,
                        },
                    },
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                    }}
                >
                    <Box
                        onClick={handleCustomerIdFilterOpen}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1.5,
                            cursor: 'pointer',
                            borderRadius: 1,
                            '&:hover': {
                                backgroundColor: '#f3f4f6',
                            },
                        }}
                    >
                        <Typography variant="body2">Customer ID</Typography>
                        <Add sx={{ fontSize: 18, color: '#6b7280' }} />
                    </Box>
                    <Box
                        onClick={handleEmailFilterOpen}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1.5,
                            cursor: 'pointer',
                            borderRadius: 1,
                            '&:hover': {
                                backgroundColor: '#f3f4f6',
                            },
                        }}
                    >
                        <Typography variant="body2">Email</Typography>
                        <Add sx={{ fontSize: 18, color: '#6b7280' }} />
                    </Box>
                    <Box
                        onClick={handleDisputeAmountFilterOpen}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1.5,
                            cursor: 'pointer',
                            borderRadius: 1,
                            '&:hover': {
                                backgroundColor: '#f3f4f6',
                            },
                        }}
                    >
                        <Typography variant="body2">Dispute amount</Typography>
                        <Add sx={{ fontSize: 18, color: '#6b7280' }} />
                    </Box>
                </Box>
            </Popover>

            {/* Customer ID Filter Popover */}
            <Popover
                open={Boolean(customerIdFilterAnchor)}
                anchorEl={customerIdFilterAnchor}
                onClose={handleCustomerIdFilterClose}
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
                            mt: 0.5,
                        },
                    },
                }}
            >
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Filter by: Customer ID
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <TextField
                        value={customerIdFilterInput}
                        onChange={e => setCustomerIdFilterInput(e.target.value)}
                        placeholder="cus_..."
                        fullWidth
                    />
                </Box>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={handleCustomerIdFilterApply}
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
                            mt: 0.5,
                        },
                    },
                }}
            >
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Filter by: Email
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <TextField
                        type="email"
                        value={emailFilterInput}
                        onChange={e => setEmailFilterInput(e.target.value)}
                        placeholder="customer@example.com"
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

            {/* Dispute Amount Filter Popover */}
            <Popover
                open={Boolean(disputeAmountFilterAnchor)}
                anchorEl={disputeAmountFilterAnchor}
                onClose={handleDisputeAmountFilterClose}
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
                            mt: 0.5,
                        },
                        ref: (el: HTMLElement | null) => {
                            if (el) disputeAmountFilterPopoverRef.current = el;
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
                    Filter by: Dispute amount
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <Select
                            value={tempDisputeAmountOperator}
                            onChange={e =>
                                setTempDisputeAmountOperator(e.target.value)
                            }
                            displayEmpty
                            onOpen={e => e.stopPropagation()}
                            onClose={e => e.stopPropagation()}
                            MenuProps={{
                                container:
                                    disputeAmountFilterPopoverRef.current ||
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
                        value={disputeAmountFilterInput}
                        onChange={e =>
                            setDisputeAmountFilterInput(e.target.value)
                        }
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
                    onClick={handleDisputeAmountFilterApply}
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
                {(dateFilterDays || dateFilterType !== 'in_last') && (
                    <Chip
                        label={
                            dateFilterType === 'in_last'
                                ? `Last ${dateFilterDays} day${dateFilterDays !== 1 ? 's' : ''}`
                                : dateFilterType === 'equal_to'
                                  ? `Date: ${dateFilterInput}`
                                  : dateFilterType === 'between'
                                    ? `Date: ${dateFilterInput} - ${dateFilterInput2}`
                                    : dateFilterType === 'on_or_after'
                                      ? `On or after: ${dateFilterInput}`
                                      : `Before or on: ${dateFilterInput}`
                        }
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
                        label={paymentMethodFilterLabel || paymentMethodFilter}
                        onDelete={handlePaymentMethodFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}

                <Button
                    variant={
                        customerIdFilter ||
                        emailFilter ||
                        disputeAmountFilter !== null
                            ? 'contained'
                            : 'outlined'
                    }
                    size="small"
                    onClick={handleMoreFiltersClick}
                    startIcon={<Add />}
                    sx={{
                        textTransform: 'none',
                        borderRadius: 1,
                        borderColor:
                            customerIdFilter ||
                            emailFilter ||
                            disputeAmountFilter !== null
                                ? '#7c3aed'
                                : '#e2e8f0',
                        ...((customerIdFilter ||
                            emailFilter ||
                            disputeAmountFilter !== null) && {
                            backgroundColor: '#7c3aed',
                            '&:hover': { backgroundColor: '#6d28d9' },
                        }),
                    }}
                >
                    More filters
                </Button>
                {customerIdFilter && (
                    <Chip
                        label={`Customer ID: ${customerIdFilter}`}
                        onDelete={handleCustomerIdFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}
                {emailFilter && (
                    <Chip
                        label={`Email: ${emailFilter}`}
                        onDelete={handleEmailFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}
                {disputeAmountFilter !== null && (
                    <Chip
                        label={`Dispute amount ${disputeAmountOperator === 'eq' ? '=' : disputeAmountOperator === 'gt' ? '>' : disputeAmountOperator === 'lt' ? '<' : disputeAmountOperator === 'gte' ? '>=' : '<='} $${disputeAmountFilter.toFixed(2)}`}
                        onDelete={handleDisputeAmountFilterClear}
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
                                <TableCell>Customer Email</TableCell>
                                <TableCell>Customer ID</TableCell>
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
                                            {transaction.customer?.id || '-'}
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
