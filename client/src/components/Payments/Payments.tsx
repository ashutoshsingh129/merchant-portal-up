import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
    '& .MuiTableRow-root': {
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: '#f8fafc',
        },
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
    const navigate = useNavigate();
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

    // New filter states for additional filters
    const [cardBrandFilter, setCardBrandFilter] = useState<string | null>(null);
    const [cardBrandFilterAnchor, setCardBrandFilterAnchor] =
        useState<HTMLButtonElement | null>(null);

    const [declineReasonFilter, setDeclineReasonFilter] = useState<
        string | null
    >(null);
    const [declineReasonFilterAnchor, setDeclineReasonFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [declineReasonFilterInput, setDeclineReasonFilterInput] =
        useState<string>('');

    const [last4DigitsFilter, setLast4DigitsFilter] = useState<string | null>(
        null
    );
    const [last4DigitsFilterAnchor, setLast4DigitsFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [last4DigitsFilterInput, setLast4DigitsFilterInput] =
        useState<string>('');

    const [disputedOnFilter, setDisputedOnFilter] = useState<number | null>(
        null
    );
    const [disputedOnFilterAnchor, setDisputedOnFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [disputedOnFilterInput, setDisputedOnFilterInput] =
        useState<string>('');

    const [disputeReasonFilter, setDisputeReasonFilter] = useState<
        string | null
    >(null);
    const [disputeReasonFilterAnchor, setDisputeReasonFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [disputeReasonFilterInput, setDisputeReasonFilterInput] =
        useState<string>('');

    const [evidenceDueByFilter, setEvidenceDueByFilter] = useState<
        number | null
    >(null);
    const [evidenceDueByFilterAnchor, setEvidenceDueByFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [evidenceDueByFilterInput, setEvidenceDueByFilterInput] =
        useState<string>('');

    const [evidenceSubmittedAtFilter, setEvidenceSubmittedAtFilter] = useState<
        number | null
    >(null);
    const [
        evidenceSubmittedAtFilterAnchor,
        setEvidenceSubmittedAtFilterAnchor,
    ] = useState<HTMLButtonElement | null>(null);
    const [evidenceSubmittedAtFilterInput, setEvidenceSubmittedAtFilterInput] =
        useState<string>('');

    const [transferredToFilter, setTransferredToFilter] = useState<
        string | null
    >(null);
    const [transferredToFilterAnchor, setTransferredToFilterAnchor] =
        useState<HTMLButtonElement | null>(null);
    const [transferredToFilterInput, setTransferredToFilterInput] =
        useState<string>('');

    // Refs for Popover containers to fix Select menu positioning
    const dateFilterPopoverRef = useRef<HTMLElement>(null);
    const amountFilterPopoverRef = useRef<HTMLElement>(null);
    const currencyFilterPopoverRef = useRef<HTMLElement>(null);
    const paymentMethodFilterPopoverRef = useRef<HTMLElement>(null);
    const disputeAmountFilterPopoverRef = useRef<HTMLElement>(null);
    const cardBrandFilterPopoverRef = useRef<HTMLElement>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Build date filter parameters
            let dateFilterTypeParam: string | undefined;
            let dateFilterInputParam: string | undefined;
            let dateFilterInput2Param: string | undefined;
            let daysParam: number | undefined;

            if (dateFilterType === 'in_last' && dateFilterDays) {
                daysParam = dateFilterDays;
            } else if (dateFilterType !== 'in_last' && dateFilterInput) {
                dateFilterTypeParam = dateFilterType;
                dateFilterInputParam = dateFilterInput;
                if (dateFilterType === 'between' && dateFilterInput2) {
                    dateFilterInput2Param = dateFilterInput2;
                }
            }

            // Use statusFilter if it has values, otherwise use selectedSummary
            // Note: selectedSummary is only for filtering transactions, NOT for summary statistics
            const statusParam =
                statusFilter.length === 0 && selectedSummary !== 'all'
                    ? selectedSummary
                    : undefined;
            const statusFilterParam =
                statusFilter.length > 0 ? statusFilter : undefined;

            // For summary: Only use statusFilter (dropdown), NOT selectedSummary (card clicks)
            // Statistics should always show overall counts, only filtered by other criteria
            const summaryStatusFilterParam =
                statusFilter.length > 0 ? statusFilter : undefined;

            // Fetch transactions and summary from database with filters
            const [transactionsResponse, summaryResponse] = await Promise.all([
                stripeService.getTransactionsFromDb({
                    page: currentPage,
                    limit: 10,
                    status: statusParam,
                    statusFilter: statusFilterParam,
                    days: daysParam,
                    dateFilterType: dateFilterTypeParam,
                    dateFilterInput: dateFilterInputParam,
                    dateFilterInput2: dateFilterInput2Param,
                    amount: amountFilter !== null ? amountFilter : undefined,
                    amountOperator:
                        amountFilter !== null ? amountOperator : undefined,
                    currency: currencyFilter || undefined,
                    paymentMethod: paymentMethodFilter || undefined,
                    customerId: customerIdFilter || undefined,
                    email: emailFilter || undefined,
                    cardBrand: cardBrandFilter || undefined,
                    declineReason: declineReasonFilter || undefined,
                    last4Digits: last4DigitsFilter || undefined,
                }),
                stripeService.getSummaryFromDb({
                    // Don't pass status or statusFilter from selectedSummary to summary
                    // Summary should only be filtered by statusFilter dropdown, not by card clicks
                    status: undefined,
                    statusFilter: summaryStatusFilterParam,
                    days: daysParam,
                    dateFilterType: dateFilterTypeParam,
                    dateFilterInput: dateFilterInputParam,
                    dateFilterInput2: dateFilterInput2Param,
                    amount: amountFilter !== null ? amountFilter : undefined,
                    amountOperator:
                        amountFilter !== null ? amountOperator : undefined,
                    currency: currencyFilter || undefined,
                    paymentMethod: paymentMethodFilter || undefined,
                    customerId: customerIdFilter || undefined,
                    email: emailFilter || undefined,
                    cardBrand: cardBrandFilter || undefined,
                    declineReason: declineReasonFilter || undefined,
                    last4Digits: last4DigitsFilter || undefined,
                }),
            ]);

            if (transactionsResponse.success) {
                // Start with transactions from database (already filtered)
                let filteredTransactions =
                    transactionsResponse.data.transactions;
                console.log(filteredTransactions);

                // Note: Most filters are now applied at the database level
                // Only apply client-side filters for dispute-related fields that can't be filtered at DB level

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

                // Note: cardBrand, declineReason, and last4Digits filters are now applied at database level

                // Apply disputed on filter
                if (disputedOnFilter !== null) {
                    const filterDateStart = disputedOnFilter;
                    const filterDateEnd = disputedOnFilter + 86400; // Add 24 hours
                    filteredTransactions = filteredTransactions.filter(
                        (transaction: StripeTransaction) => {
                            const disputedOn = (transaction as any).disputed_on;
                            if (!disputedOn) return false;
                            return (
                                disputedOn >= filterDateStart &&
                                disputedOn < filterDateEnd
                            );
                        }
                    );
                }

                // Apply dispute reason filter
                if (disputeReasonFilter) {
                    filteredTransactions = filteredTransactions.filter(
                        (transaction: StripeTransaction) => {
                            const disputeReason = (transaction as any)
                                .dispute_reason;
                            if (!disputeReason) return false;
                            return disputeReason
                                .toLowerCase()
                                .includes(disputeReasonFilter.toLowerCase());
                        }
                    );
                }

                // Apply evidence due by filter
                if (evidenceDueByFilter !== null) {
                    const filterDateStart = evidenceDueByFilter;
                    const filterDateEnd = evidenceDueByFilter + 86400; // Add 24 hours
                    filteredTransactions = filteredTransactions.filter(
                        (transaction: StripeTransaction) => {
                            const evidenceDueBy = (transaction as any)
                                .evidence_due_by;
                            if (!evidenceDueBy) return false;
                            return (
                                evidenceDueBy >= filterDateStart &&
                                evidenceDueBy < filterDateEnd
                            );
                        }
                    );
                }

                // Apply evidence submitted at filter
                if (evidenceSubmittedAtFilter !== null) {
                    const filterDateStart = evidenceSubmittedAtFilter;
                    const filterDateEnd = evidenceSubmittedAtFilter + 86400; // Add 24 hours
                    filteredTransactions = filteredTransactions.filter(
                        (transaction: StripeTransaction) => {
                            const evidenceSubmittedAt = (transaction as any)
                                .evidence_submitted_at;
                            if (!evidenceSubmittedAt) return false;
                            return (
                                evidenceSubmittedAt >= filterDateStart &&
                                evidenceSubmittedAt < filterDateEnd
                            );
                        }
                    );
                }

                // Apply transferred to filter
                if (transferredToFilter) {
                    filteredTransactions = filteredTransactions.filter(
                        (transaction: StripeTransaction) => {
                            const transferredTo = (transaction as any)
                                .transferred_to;
                            if (!transferredTo) return false;
                            return transferredTo
                                .toLowerCase()
                                .includes(transferredToFilter.toLowerCase());
                        }
                    );
                }

                // Always replace data to avoid duplicates
                // Backend handles pagination, so we just show what it returns
                setTransactions(filteredTransactions);
                setHasMore(transactionsResponse.data.hasMore);

                // Use summary from database (already filtered)
                if (summaryResponse.success) {
                    setSummary(summaryResponse.data);
                } else {
                    // Fallback: calculate from current page if summary fetch fails
                    const summaryData = {
                        total: transactionsResponse.data.total,
                        succeeded: filteredTransactions.filter(
                            (t: StripeTransaction) => t.status === 'succeeded'
                        ).length,
                        refunded: filteredTransactions.filter(
                            (t: StripeTransaction) =>
                                t.status === 'refunded' || t.refunded
                        ).length,
                        disputed: 0,
                        failed: filteredTransactions.filter(
                            (t: StripeTransaction) => t.status === 'failed'
                        ).length,
                        uncaptured: filteredTransactions.filter(
                            (t: StripeTransaction) => t.status === 'pending'
                        ).length,
                    };
                    setSummary(summaryData);
                }

                console.log(
                    `Payments: Received ${transactionsResponse.data.transactions.length} transactions from database, total: ${transactionsResponse.data.total}, has_more: ${transactionsResponse.data.hasMore}, page: ${transactionsResponse.data.page}`
                );
            } else {
                setError(transactionsResponse.message);
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
        cardBrandFilter,
        declineReasonFilter,
        last4DigitsFilter,
        disputedOnFilter,
        disputeReasonFilter,
        evidenceDueByFilter,
        evidenceSubmittedAtFilter,
        transferredToFilter,
    ]);

    // State for sync management
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<string>('');
    const batchSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const hasCheckedInitialSync = useRef(false);

    // Start background batch sync (100 records per request)
    const startBackgroundBatchSync = useCallback(() => {
        // Clear any existing interval
        if (batchSyncIntervalRef.current) {
            clearInterval(batchSyncIntervalRef.current);
        }

        // Start batch sync immediately, then continue every 5 seconds
        const syncBatch = async () => {
            try {
                const response = await stripeService.triggerBatchSync({
                    batchSize: 100,
                });

                if (response.success) {
                    const totalSynced =
                        response.data.paymentIntents.synced +
                        response.data.charges.synced;

                    if (totalSynced > 0) {
                        setSyncStatus(
                            `Syncing in background: ${totalSynced} records...`
                        );
                    }

                    // If no more records to sync, stop the interval
                    if (!response.data.hasMore) {
                        if (batchSyncIntervalRef.current) {
                            clearInterval(batchSyncIntervalRef.current);
                            batchSyncIntervalRef.current = null;
                        }
                        setSyncStatus('All records synced');
                        setIsSyncing(false);
                    }
                }
            } catch (error) {
                console.error('Error in background batch sync:', error);
            }
        };

        // Run immediately
        syncBatch();

        // Then run every 5 seconds
        batchSyncIntervalRef.current = setInterval(syncBatch, 5000);
    }, []);

    // Check if initial sync is needed and trigger it (only once on mount)
    useEffect(() => {
        const checkAndTriggerInitialSync = async () => {
            if (hasCheckedInitialSync.current) return;
            hasCheckedInitialSync.current = true;

            try {
                // Check if we have any records in DB
                const response = await stripeService.getTransactionsFromDb({
                    page: 1,
                    limit: 1,
                });

                // If no records, trigger initial sync
                if (response.success && response.data.total === 0) {
                    setIsSyncing(true);
                    setSyncStatus(
                        'Starting initial sync (first 10 records)...'
                    );

                    const syncResponse =
                        await stripeService.triggerInitialSync();

                    if (syncResponse.success) {
                        setSyncStatus(
                            `Initial sync completed: ${syncResponse.data.paymentIntents.synced} payment intents, ${syncResponse.data.charges.synced} charges`
                        );

                        // Fetch the initial data
                        fetchData();

                        // Start background batch sync
                        startBackgroundBatchSync();
                    } else {
                        setSyncStatus('Initial sync failed');
                        setIsSyncing(false);
                    }
                } else if (response.success && response.data.total > 0) {
                    // We have records, start background batch sync to continue syncing
                    setIsSyncing(true);
                    setSyncStatus('Continuing background sync...');
                    startBackgroundBatchSync();
                }
            } catch (error) {
                console.error('Error checking sync status:', error);
                setSyncStatus('Error checking sync status');
                setIsSyncing(false);
            }
        };

        checkAndTriggerInitialSync();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (batchSyncIntervalRef.current) {
                clearInterval(batchSyncIntervalRef.current);
            }
        };
    }, []);

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

    // Card brand filter handlers
    const handleCardBrandFilterOpen = () => {
        const anchor = moreFiltersAnchor;
        setMoreFiltersAnchor(null);
        setTimeout(() => {
            setCardBrandFilterAnchor(anchor);
        }, 100);
    };

    const handleCardBrandFilterClose = () => {
        setCardBrandFilterAnchor(null);
    };

    const handleCardBrandFilterApply = (brand: string) => {
        setCardBrandFilter(brand === 'all' ? null : brand);
        setCurrentPage(1);
        setTransactions([]);
        handleCardBrandFilterClose();
    };

    const handleCardBrandFilterClear = () => {
        setCardBrandFilter(null);
        setCurrentPage(1);
        setTransactions([]);
    };

    // Decline reason filter handlers
    const handleDeclineReasonFilterOpen = () => {
        const anchor = moreFiltersAnchor;
        setMoreFiltersAnchor(null);
        setTimeout(() => {
            setDeclineReasonFilterAnchor(anchor);
        }, 100);
    };

    const handleDeclineReasonFilterClose = () => {
        setDeclineReasonFilterAnchor(null);
    };

    const handleDeclineReasonFilterApply = () => {
        const reason = declineReasonFilterInput.trim();
        setDeclineReasonFilter(reason === '' ? null : reason);
        setCurrentPage(1);
        setTransactions([]);
        handleDeclineReasonFilterClose();
    };

    const handleDeclineReasonFilterClear = () => {
        setDeclineReasonFilter(null);
        setDeclineReasonFilterInput('');
        setCurrentPage(1);
        setTransactions([]);
    };

    // Last 4 digits filter handlers
    const handleLast4DigitsFilterOpen = () => {
        const anchor = moreFiltersAnchor;
        setMoreFiltersAnchor(null);
        setTimeout(() => {
            setLast4DigitsFilterAnchor(anchor);
        }, 100);
    };

    const handleLast4DigitsFilterClose = () => {
        setLast4DigitsFilterAnchor(null);
    };

    const handleLast4DigitsFilterApply = () => {
        const digits = last4DigitsFilterInput.trim();
        setLast4DigitsFilter(digits === '' ? null : digits);
        setCurrentPage(1);
        setTransactions([]);
        handleLast4DigitsFilterClose();
    };

    const handleLast4DigitsFilterClear = () => {
        setLast4DigitsFilter(null);
        setLast4DigitsFilterInput('');
        setCurrentPage(1);
        setTransactions([]);
    };

    // Disputed on filter handlers
    const handleDisputedOnFilterOpen = () => {
        const anchor = moreFiltersAnchor;
        setMoreFiltersAnchor(null);
        setTimeout(() => {
            setDisputedOnFilterAnchor(anchor);
        }, 100);
    };

    const handleDisputedOnFilterClose = () => {
        setDisputedOnFilterAnchor(null);
    };

    const handleDisputedOnFilterApply = () => {
        if (disputedOnFilterInput) {
            const date = new Date(disputedOnFilterInput);
            date.setHours(0, 0, 0, 0);
            setDisputedOnFilter(Math.floor(date.getTime() / 1000));
        } else {
            setDisputedOnFilter(null);
        }
        setCurrentPage(1);
        setTransactions([]);
        handleDisputedOnFilterClose();
    };

    const handleDisputedOnFilterClear = () => {
        setDisputedOnFilter(null);
        setDisputedOnFilterInput('');
        setCurrentPage(1);
        setTransactions([]);
    };

    // Dispute reason filter handlers
    const handleDisputeReasonFilterOpen = () => {
        const anchor = moreFiltersAnchor;
        setMoreFiltersAnchor(null);
        setTimeout(() => {
            setDisputeReasonFilterAnchor(anchor);
        }, 100);
    };

    const handleDisputeReasonFilterClose = () => {
        setDisputeReasonFilterAnchor(null);
    };

    const handleDisputeReasonFilterApply = () => {
        const reason = disputeReasonFilterInput.trim();
        setDisputeReasonFilter(reason === '' ? null : reason);
        setCurrentPage(1);
        setTransactions([]);
        handleDisputeReasonFilterClose();
    };

    const handleDisputeReasonFilterClear = () => {
        setDisputeReasonFilter(null);
        setDisputeReasonFilterInput('');
        setCurrentPage(1);
        setTransactions([]);
    };

    // Evidence due by filter handlers
    const handleEvidenceDueByFilterOpen = () => {
        const anchor = moreFiltersAnchor;
        setMoreFiltersAnchor(null);
        setTimeout(() => {
            setEvidenceDueByFilterAnchor(anchor);
        }, 100);
    };

    const handleEvidenceDueByFilterClose = () => {
        setEvidenceDueByFilterAnchor(null);
    };

    const handleEvidenceDueByFilterApply = () => {
        if (evidenceDueByFilterInput) {
            const date = new Date(evidenceDueByFilterInput);
            date.setHours(0, 0, 0, 0);
            setEvidenceDueByFilter(Math.floor(date.getTime() / 1000));
        } else {
            setEvidenceDueByFilter(null);
        }
        setCurrentPage(1);
        setTransactions([]);
        handleEvidenceDueByFilterClose();
    };

    const handleEvidenceDueByFilterClear = () => {
        setEvidenceDueByFilter(null);
        setEvidenceDueByFilterInput('');
        setCurrentPage(1);
        setTransactions([]);
    };

    // Evidence submitted at filter handlers
    const handleEvidenceSubmittedAtFilterOpen = () => {
        const anchor = moreFiltersAnchor;
        setMoreFiltersAnchor(null);
        setTimeout(() => {
            setEvidenceSubmittedAtFilterAnchor(anchor);
        }, 100);
    };

    const handleEvidenceSubmittedAtFilterClose = () => {
        setEvidenceSubmittedAtFilterAnchor(null);
    };

    const handleEvidenceSubmittedAtFilterApply = () => {
        if (evidenceSubmittedAtFilterInput) {
            const date = new Date(evidenceSubmittedAtFilterInput);
            date.setHours(0, 0, 0, 0);
            setEvidenceSubmittedAtFilter(Math.floor(date.getTime() / 1000));
        } else {
            setEvidenceSubmittedAtFilter(null);
        }
        setCurrentPage(1);
        setTransactions([]);
        handleEvidenceSubmittedAtFilterClose();
    };

    const handleEvidenceSubmittedAtFilterClear = () => {
        setEvidenceSubmittedAtFilter(null);
        setEvidenceSubmittedAtFilterInput('');
        setCurrentPage(1);
        setTransactions([]);
    };

    // Transferred to filter handlers
    const handleTransferredToFilterOpen = () => {
        const anchor = moreFiltersAnchor;
        setMoreFiltersAnchor(null);
        setTimeout(() => {
            setTransferredToFilterAnchor(anchor);
        }, 100);
    };

    const handleTransferredToFilterClose = () => {
        setTransferredToFilterAnchor(null);
    };

    const handleTransferredToFilterApply = () => {
        const transferredTo = transferredToFilterInput.trim();
        setTransferredToFilter(transferredTo === '' ? null : transferredTo);
        setCurrentPage(1);
        setTransactions([]);
        handleTransferredToFilterClose();
    };

    const handleTransferredToFilterClear = () => {
        setTransferredToFilter(null);
        setTransferredToFilterInput('');
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

            {/* Sync Status Indicator */}
            {syncStatus && (
                <Alert
                    severity={isSyncing ? 'info' : 'success'}
                    sx={{ mb: 2 }}
                    icon={
                        isSyncing ? <CircularProgress size={16} /> : undefined
                    }
                >
                    {syncStatus}
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
                    <Box
                        onClick={handleCardBrandFilterOpen}
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
                        <Typography variant="body2">Card brand</Typography>
                        <Add sx={{ fontSize: 18, color: '#6b7280' }} />
                    </Box>
                    <Box
                        onClick={handleDeclineReasonFilterOpen}
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
                        <Typography variant="body2">Decline reason</Typography>
                        <Add sx={{ fontSize: 18, color: '#6b7280' }} />
                    </Box>
                    <Box
                        onClick={handleLast4DigitsFilterOpen}
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
                        <Typography variant="body2">Last 4 digits</Typography>
                        <Add sx={{ fontSize: 18, color: '#6b7280' }} />
                    </Box>
                    <Box
                        onClick={handleDisputedOnFilterOpen}
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
                        <Typography variant="body2">Disputed on</Typography>
                        <Add sx={{ fontSize: 18, color: '#6b7280' }} />
                    </Box>
                    <Box
                        onClick={handleDisputeReasonFilterOpen}
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
                        <Typography variant="body2">Dispute reason</Typography>
                        <Add sx={{ fontSize: 18, color: '#6b7280' }} />
                    </Box>
                    <Box
                        onClick={handleEvidenceDueByFilterOpen}
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
                        <Typography variant="body2">Evidence due by</Typography>
                        <Add sx={{ fontSize: 18, color: '#6b7280' }} />
                    </Box>
                    <Box
                        onClick={handleEvidenceSubmittedAtFilterOpen}
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
                        <Typography variant="body2">
                            Evidence submitted at
                        </Typography>
                        <Add sx={{ fontSize: 18, color: '#6b7280' }} />
                    </Box>
                    <Box
                        onClick={handleTransferredToFilterOpen}
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
                        <Typography variant="body2">Transferred to</Typography>
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

            {/* Card Brand Filter Popover */}
            <Popover
                open={Boolean(cardBrandFilterAnchor)}
                anchorEl={cardBrandFilterAnchor}
                onClose={handleCardBrandFilterClose}
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
                            mt: 0.5,
                        },
                        ref: (el: HTMLElement | null) => {
                            if (el) cardBrandFilterPopoverRef.current = el;
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
                    Filter by: card brand
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <FormControl fullWidth>
                        <Select
                            value={cardBrandFilter || 'all'}
                            onChange={e =>
                                handleCardBrandFilterApply(e.target.value)
                            }
                            displayEmpty
                            onOpen={e => e.stopPropagation()}
                            onClose={e => e.stopPropagation()}
                            MenuProps={{
                                container:
                                    cardBrandFilterPopoverRef.current ||
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
                            <MenuItem value="all">All card brands</MenuItem>
                            <MenuItem value="amex">American Express</MenuItem>
                            <MenuItem value="cartes_bancaires">
                                Cartes Bancaires
                            </MenuItem>
                            <MenuItem value="diners">Diners Club</MenuItem>
                            <MenuItem value="discover">Discover</MenuItem>
                            <MenuItem value="eftpos_au">
                                eftpos Australia
                            </MenuItem>
                            <MenuItem value="jcb">JCB</MenuItem>
                            <MenuItem value="link">Link</MenuItem>
                            <MenuItem value="mastercard">MasterCard</MenuItem>
                            <MenuItem value="unionpay">UnionPay</MenuItem>
                            <MenuItem value="visa">Visa</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Popover>

            {/* Decline Reason Filter Popover */}
            <Popover
                open={Boolean(declineReasonFilterAnchor)}
                anchorEl={declineReasonFilterAnchor}
                onClose={handleDeclineReasonFilterClose}
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
                    Filter by: Decline reason
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <TextField
                        value={declineReasonFilterInput}
                        onChange={e =>
                            setDeclineReasonFilterInput(e.target.value)
                        }
                        placeholder="Enter decline reason"
                        fullWidth
                    />
                </Box>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={handleDeclineReasonFilterApply}
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

            {/* Last 4 Digits Filter Popover */}
            <Popover
                open={Boolean(last4DigitsFilterAnchor)}
                anchorEl={last4DigitsFilterAnchor}
                onClose={handleLast4DigitsFilterClose}
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
                    Filter by: Last 4 digits
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <TextField
                        value={last4DigitsFilterInput}
                        onChange={e =>
                            setLast4DigitsFilterInput(e.target.value)
                        }
                        placeholder="4242"
                        fullWidth
                        inputProps={{ maxLength: 4 }}
                    />
                </Box>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={handleLast4DigitsFilterApply}
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

            {/* Disputed On Filter Popover */}
            <Popover
                open={Boolean(disputedOnFilterAnchor)}
                anchorEl={disputedOnFilterAnchor}
                onClose={handleDisputedOnFilterClose}
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
                    Filter by: Disputed on
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <TextField
                        type="date"
                        value={disputedOnFilterInput}
                        onChange={e => setDisputedOnFilterInput(e.target.value)}
                        fullWidth
                        InputLabelProps={{
                            shrink: true,
                        }}
                    />
                </Box>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={handleDisputedOnFilterApply}
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

            {/* Dispute Reason Filter Popover */}
            <Popover
                open={Boolean(disputeReasonFilterAnchor)}
                anchorEl={disputeReasonFilterAnchor}
                onClose={handleDisputeReasonFilterClose}
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
                    Filter by: Dispute reason
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <TextField
                        value={disputeReasonFilterInput}
                        onChange={e =>
                            setDisputeReasonFilterInput(e.target.value)
                        }
                        placeholder="Enter dispute reason"
                        fullWidth
                    />
                </Box>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={handleDisputeReasonFilterApply}
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

            {/* Evidence Due By Filter Popover */}
            <Popover
                open={Boolean(evidenceDueByFilterAnchor)}
                anchorEl={evidenceDueByFilterAnchor}
                onClose={handleEvidenceDueByFilterClose}
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
                    Filter by: Evidence due by
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <TextField
                        type="date"
                        value={evidenceDueByFilterInput}
                        onChange={e =>
                            setEvidenceDueByFilterInput(e.target.value)
                        }
                        fullWidth
                        InputLabelProps={{
                            shrink: true,
                        }}
                    />
                </Box>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={handleEvidenceDueByFilterApply}
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

            {/* Evidence Submitted At Filter Popover */}
            <Popover
                open={Boolean(evidenceSubmittedAtFilterAnchor)}
                anchorEl={evidenceSubmittedAtFilterAnchor}
                onClose={handleEvidenceSubmittedAtFilterClose}
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
                    Filter by: Evidence submitted at
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <TextField
                        type="date"
                        value={evidenceSubmittedAtFilterInput}
                        onChange={e =>
                            setEvidenceSubmittedAtFilterInput(e.target.value)
                        }
                        fullWidth
                        InputLabelProps={{
                            shrink: true,
                        }}
                    />
                </Box>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={handleEvidenceSubmittedAtFilterApply}
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

            {/* Transferred To Filter Popover */}
            <Popover
                open={Boolean(transferredToFilterAnchor)}
                anchorEl={transferredToFilterAnchor}
                onClose={handleTransferredToFilterClose}
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
                    Filter by: Transferred to
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <TextField
                        value={transferredToFilterInput}
                        onChange={e =>
                            setTransferredToFilterInput(e.target.value)
                        }
                        placeholder="Enter account ID or email"
                        fullWidth
                    />
                </Box>
                <Button
                    variant="contained"
                    fullWidth
                    onClick={handleTransferredToFilterApply}
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
                        disputeAmountFilter !== null ||
                        cardBrandFilter ||
                        declineReasonFilter ||
                        last4DigitsFilter ||
                        disputedOnFilter !== null ||
                        disputeReasonFilter ||
                        evidenceDueByFilter !== null ||
                        evidenceSubmittedAtFilter !== null ||
                        transferredToFilter
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
                            disputeAmountFilter !== null ||
                            cardBrandFilter ||
                            declineReasonFilter ||
                            last4DigitsFilter ||
                            disputedOnFilter !== null ||
                            disputeReasonFilter ||
                            evidenceDueByFilter !== null ||
                            evidenceSubmittedAtFilter !== null ||
                            transferredToFilter
                                ? '#7c3aed'
                                : '#e2e8f0',
                        ...((customerIdFilter ||
                            emailFilter ||
                            disputeAmountFilter !== null ||
                            cardBrandFilter ||
                            declineReasonFilter ||
                            last4DigitsFilter ||
                            disputedOnFilter !== null ||
                            disputeReasonFilter ||
                            evidenceDueByFilter !== null ||
                            evidenceSubmittedAtFilter !== null ||
                            transferredToFilter) && {
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
                {cardBrandFilter && (
                    <Chip
                        label={`Card brand: ${cardBrandFilter === 'amex' ? 'American Express' : cardBrandFilter === 'cartes_bancaires' ? 'Cartes Bancaires' : cardBrandFilter === 'diners' ? 'Diners Club' : cardBrandFilter === 'discover' ? 'Discover' : cardBrandFilter === 'eftpos_au' ? 'eftpos Australia' : cardBrandFilter === 'jcb' ? 'JCB' : cardBrandFilter === 'link' ? 'Link' : cardBrandFilter === 'mastercard' ? 'MasterCard' : cardBrandFilter === 'unionpay' ? 'UnionPay' : 'Visa'}`}
                        onDelete={handleCardBrandFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}
                {declineReasonFilter && (
                    <Chip
                        label={`Decline reason: ${declineReasonFilter}`}
                        onDelete={handleDeclineReasonFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}
                {last4DigitsFilter && (
                    <Chip
                        label={`Last 4: ${last4DigitsFilter}`}
                        onDelete={handleLast4DigitsFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}
                {disputedOnFilter !== null && (
                    <Chip
                        label={`Disputed on: ${stripeService.formatDate(disputedOnFilter)}`}
                        onDelete={handleDisputedOnFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}
                {disputeReasonFilter && (
                    <Chip
                        label={`Dispute reason: ${disputeReasonFilter}`}
                        onDelete={handleDisputeReasonFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}
                {evidenceDueByFilter !== null && (
                    <Chip
                        label={`Evidence due by: ${stripeService.formatDate(evidenceDueByFilter)}`}
                        onDelete={handleEvidenceDueByFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}
                {evidenceSubmittedAtFilter !== null && (
                    <Chip
                        label={`Evidence submitted: ${stripeService.formatDate(evidenceSubmittedAtFilter)}`}
                        onDelete={handleEvidenceSubmittedAtFilterClear}
                        color="primary"
                        sx={{ backgroundColor: '#7c3aed' }}
                    />
                )}
                {transferredToFilter && (
                    <Chip
                        label={`Transferred to: ${transferredToFilter}`}
                        onDelete={handleTransferredToFilterClear}
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
                                <TableRow
                                    key={transaction.id}
                                    onClick={() =>
                                        navigate(`/payments/${transaction.id}`)
                                    }
                                >
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

                {/* Pagination Controls */}
                {transactions.length > 0 && (
                    <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        mt={3}
                        mb={2}
                        px={2}
                    >
                        <Button
                            variant="outlined"
                            disabled={currentPage === 1 || loading}
                            onClick={() =>
                                setCurrentPage(prev => Math.max(1, prev - 1))
                            }
                        >
                            Previous
                        </Button>
                        <Typography variant="body2" color="text.secondary">
                            Page {currentPage}
                        </Typography>
                        <Button
                            variant="outlined"
                            disabled={!hasMore || loading}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                        >
                            Next
                        </Button>
                    </Box>
                )}
            </Box>
        </StyledContainer>
    );
};

export default Payments;
