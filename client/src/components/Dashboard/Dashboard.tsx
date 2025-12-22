import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    CircularProgress,
    Alert,
    Button,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Paper,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { styled } from '@mui/material/styles';
import { stripeService } from '../../services/stripeService';

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
    height: '100%',
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

const ChartCard = styled(Card)(({ theme }) => ({
    borderRadius: theme.spacing(1),
    border: '1px solid #e2e8f0',
    marginTop: theme.spacing(2),
}));

const ChartCardContent = styled(CardContent)(({ theme }) => ({
    padding: theme.spacing(3),
    '&:last-child': {
        paddingBottom: theme.spacing(3),
    },
}));

type VolumeType = 'gross' | 'net' | 'newCustomers';

const Dashboard: React.FC = () => {
    const [volumeData, setVolumeData] = useState<any[]>([]);
    const [totals, setTotals] = useState({
        gross: 0,
        net: 0,
        count: 0,
        newCustomers: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDays, setSelectedDays] = useState<number>(1);
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [volumeType, setVolumeType] = useState<VolumeType>('net');
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    // Process volume data to show cumulative values and fill missing time periods (like Stripe)
    const processVolumeDataForChart = useCallback(
        (
            data: Array<{
                time: string;
                gross: number;
                net: number;
                count: number;
                newCustomers: number;
            }>,
            period: {
                days: number;
                groupBy: 'hour' | 'day';
                startTime: number;
                endTime: number;
            }
        ) => {
            if (data.length === 0) {
                // If no data, still generate empty time periods for the full range
                const allTimePeriods: string[] = [];
                const startDate = new Date(period.startTime * 1000);
                const endDate = new Date(period.endTime * 1000);

                if (period.groupBy === 'hour') {
                    const current = new Date(startDate);
                    current.setMinutes(0, 0, 0);

                    while (current <= endDate) {
                        const dateStr = current.toISOString().split('T')[0];
                        const hour = current.getHours();
                        const timeKey = `${dateStr} ${hour.toString().padStart(2, '0')}:00`;
                        allTimePeriods.push(timeKey);
                        current.setHours(current.getHours() + 1);
                    }
                } else {
                    const current = new Date(startDate);
                    current.setHours(0, 0, 0, 0);

                    while (current <= endDate) {
                        const timeKey = current.toISOString().split('T')[0];
                        allTimePeriods.push(timeKey);
                        current.setDate(current.getDate() + 1);
                    }
                }

                return allTimePeriods.map(time => ({
                    time,
                    gross: 0,
                    net: 0,
                    count: 0,
                    newCustomers: 0,
                }));
            }

            const groupBy = period.groupBy;
            const dataMap = new Map<string, (typeof data)[0]>();

            // Create a map of existing data
            data.forEach(item => {
                dataMap.set(item.time, item);
            });

            // Generate all time periods in the range
            const allTimePeriods: string[] = [];
            const startDate = new Date(period.startTime * 1000);
            const endDate = new Date(period.endTime * 1000);

            if (groupBy === 'hour') {
                // Generate all hours in the range
                const current = new Date(startDate);
                current.setMinutes(0, 0, 0);

                while (current <= endDate) {
                    const dateStr = current.toISOString().split('T')[0];
                    const hour = current.getHours();
                    const timeKey = `${dateStr} ${hour.toString().padStart(2, '0')}:00`;
                    allTimePeriods.push(timeKey);
                    current.setHours(current.getHours() + 1);
                }
            } else {
                // Generate all days in the range
                const current = new Date(startDate);
                current.setHours(0, 0, 0, 0);

                while (current <= endDate) {
                    const timeKey = current.toISOString().split('T')[0];
                    allTimePeriods.push(timeKey);
                    current.setDate(current.getDate() + 1);
                }
            }

            // Build cumulative data
            let cumulativeGross = 0;
            let cumulativeNet = 0;
            let cumulativeCount = 0;
            let cumulativeNewCustomers = 0;

            const processedData = allTimePeriods.map(time => {
                const existing = dataMap.get(time);

                if (existing) {
                    cumulativeGross += existing.gross;
                    cumulativeNet += existing.net;
                    cumulativeCount += existing.count;
                    cumulativeNewCustomers += existing.newCustomers;
                }

                return {
                    time,
                    gross: cumulativeGross,
                    net: cumulativeNet,
                    count: cumulativeCount,
                    newCustomers: cumulativeNewCustomers,
                };
            });

            return processedData;
        },
        []
    );

    const fetchVolumeData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params: {
                days?: number;
                groupBy?: 'hour' | 'day';
                date?: Date;
            } = {};

            if (selectedDays === -1 && selectedDate) {
                // Use specific date when "Select Date" is chosen
                params.date = selectedDate;
                params.groupBy = 'hour'; // Always use hour for single day
            } else if (selectedDays !== -1) {
                // Use days parameter for preset periods
                params.days = selectedDays;
                params.groupBy = selectedDays === 1 ? 'hour' : 'day';
            } else {
                // Default to today if nothing is selected
                params.days = 1;
                params.groupBy = 'hour';
            }

            const response = await stripeService.getVolumeData(params);

            if (response.success) {
                // Process data to show cumulative volume (like Stripe)
                const processedData = processVolumeDataForChart(
                    response.data.data,
                    response.data.period
                );
                setVolumeData(processedData);
                setTotals(response.data.totals);
                setLastUpdate(new Date());
            } else {
                setError(response.message);
            }
        } catch (err) {
            setError('Failed to fetch volume data');
            console.error('Error fetching volume data:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedDays, selectedDate, processVolumeDataForChart]);

    useEffect(() => {
        fetchVolumeData();
    }, [selectedDays, selectedDate]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const formatTimeLabel = (time: string, groupBy: 'hour' | 'day') => {
        if (groupBy === 'hour') {
            // Format: "2025-11-07 10:00" -> "10:00 AM"
            const [date, timeStr] = time.split(' ');
            const [hours] = timeStr.split(':');
            const hour = parseInt(hours);
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            return `${displayHour}:00 ${period}`;
        } else {
            // Format: "2025-11-07" -> "Nov 7"
            const date = new Date(time);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
            });
        }
    };

    const formatXAxisLabel = (time: string) => {
        const groupBy = selectedDate
            ? 'hour'
            : selectedDays === 1
              ? 'hour'
              : 'day';
        return formatTimeLabel(time, groupBy);
    };

    const getGroupBy = (): 'hour' | 'day' => {
        return selectedDate ? 'hour' : selectedDays === 1 ? 'hour' : 'day';
    };

    if (loading && volumeData.length === 0) {
        return (
            <LocalizationProvider dateAdapter={AdapterDateFns}>
                <StyledContainer>
                    <HeaderSection>
                        <PageTitle>Dashboard</PageTitle>
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
            </LocalizationProvider>
        );
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <StyledContainer>
                <HeaderSection>
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 2,
                        }}
                    >
                        <PageTitle>Dashboard</PageTitle>
                        <Box
                            sx={{
                                display: 'flex',
                                gap: 2,
                                alignItems: 'center',
                                flexWrap: 'wrap',
                            }}
                        >
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                <InputLabel>Period</InputLabel>
                                <Select
                                    value={selectedDays}
                                    label="Period"
                                    onChange={e => {
                                        const days = parseInt(
                                            String(e.target.value)
                                        );
                                        setSelectedDays(days);
                                        // Set date to today when using preset period
                                        if (days === 1) {
                                            setSelectedDate(new Date());
                                        } else if (days !== -1) {
                                            setSelectedDate(null);
                                        }
                                    }}
                                >
                                    <MenuItem value={1}>Today</MenuItem>
                                    <MenuItem value={7}>Last 7 days</MenuItem>
                                    <MenuItem value={30}>Last 30 days</MenuItem>
                                    <MenuItem value={-1}>Select Date</MenuItem>
                                </Select>
                            </FormControl>
                            <Box
                                sx={{
                                    display: 'flex',
                                    gap: 2,
                                    alignItems: 'center',
                                }}
                            >
                                <FormControl
                                    size="small"
                                    sx={{ minWidth: 150 }}
                                >
                                    <InputLabel>
                                        {volumeType === 'gross'
                                            ? 'Gross Volume'
                                            : volumeType === 'net'
                                              ? 'Net Volume'
                                              : 'New Customers'}
                                    </InputLabel>
                                    <Select
                                        value={volumeType}
                                        label={
                                            volumeType === 'gross'
                                                ? 'Gross Volume'
                                                : volumeType === 'net'
                                                  ? 'Net Volume'
                                                  : 'New Customers'
                                        }
                                        onChange={e =>
                                            setVolumeType(
                                                e.target.value as VolumeType
                                            )
                                        }
                                    >
                                        <MenuItem value="gross">
                                            Gross Volume
                                        </MenuItem>
                                        <MenuItem value="net">
                                            Net Volume
                                        </MenuItem>
                                        <MenuItem value="newCustomers">
                                            New Customers
                                        </MenuItem>
                                    </Select>
                                </FormControl>
                                <DatePicker
                                    label="Date"
                                    value={selectedDate}
                                    onChange={newValue => {
                                        setSelectedDate(newValue);
                                        if (newValue) {
                                            setSelectedDays(-1);
                                        }
                                    }}
                                    slotProps={{
                                        textField: { size: 'small' },
                                    }}
                                />
                            </Box>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={fetchVolumeData}
                                startIcon={<Refresh />}
                                disabled={loading}
                            >
                                Refresh
                            </Button>
                        </Box>
                    </Box>
                </HeaderSection>

                {error && (
                    <Alert severity="error" sx={{ mb: 2, mx: 2 }}>
                        {error}
                    </Alert>
                )}

                {/* Summary Cards */}
                <Grid container spacing={2} sx={{ px: 2 }}>
                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                        <SummaryCard>
                            <SummaryCardContent>
                                <SummaryNumber>
                                    {formatCurrency(totals.gross)}
                                </SummaryNumber>
                                <SummaryLabel>
                                    Gross Volume
                                    {lastUpdate &&
                                        ` • ${lastUpdate.toLocaleTimeString(
                                            'en-US',
                                            {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                            }
                                        )}`}
                                </SummaryLabel>
                            </SummaryCardContent>
                        </SummaryCard>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                        <SummaryCard>
                            <SummaryCardContent>
                                <SummaryNumber>
                                    {formatCurrency(totals.net)}
                                </SummaryNumber>
                                <SummaryLabel>
                                    Net Volume
                                    {lastUpdate &&
                                        ` • ${lastUpdate.toLocaleTimeString(
                                            'en-US',
                                            {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                            }
                                        )}`}
                                </SummaryLabel>
                            </SummaryCardContent>
                        </SummaryCard>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                        <SummaryCard>
                            <SummaryCardContent>
                                <SummaryNumber>{totals.count}</SummaryNumber>
                                <SummaryLabel>
                                    Transactions
                                    {lastUpdate &&
                                        ` • ${lastUpdate.toLocaleTimeString(
                                            'en-US',
                                            {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                            }
                                        )}`}
                                </SummaryLabel>
                            </SummaryCardContent>
                        </SummaryCard>
                    </Grid>
                </Grid>

                {/* Volume Charts */}
                <Box sx={{ px: 2 }}>
                    <ChartCard>
                        <ChartCardContent>
                            <Typography
                                variant="h6"
                                sx={{
                                    mb: 3,
                                    fontWeight: 600,
                                    color: '#2d3748',
                                }}
                            >
                                {volumeType === 'newCustomers'
                                    ? 'New Customer Onboarding'
                                    : volumeType === 'gross'
                                      ? 'Gross Volume Over Time'
                                      : 'Net Volume Over Time'}
                            </Typography>
                            {loading ? (
                                <Box
                                    display="flex"
                                    justifyContent="center"
                                    alignItems="center"
                                    minHeight="300px"
                                >
                                    <CircularProgress />
                                </Box>
                            ) : volumeData.length === 0 ? (
                                <Box
                                    display="flex"
                                    justifyContent="center"
                                    alignItems="center"
                                    minHeight="300px"
                                >
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        No volume data available for the
                                        selected period
                                    </Typography>
                                </Box>
                            ) : (
                                <ResponsiveContainer width="100%" height={400}>
                                    <AreaChart
                                        data={volumeData}
                                        margin={{
                                            top: 10,
                                            right: 10,
                                            left: 0,
                                            bottom: 0,
                                        }}
                                    >
                                        <defs>
                                            <linearGradient
                                                id="colorGross"
                                                x1="0"
                                                y1="0"
                                                x2="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="5%"
                                                    stopColor="#635BFF"
                                                    stopOpacity={0.3}
                                                />
                                                <stop
                                                    offset="95%"
                                                    stopColor="#635BFF"
                                                    stopOpacity={0}
                                                />
                                            </linearGradient>
                                            <linearGradient
                                                id="colorNet"
                                                x1="0"
                                                y1="0"
                                                x2="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="5%"
                                                    stopColor="#00D924"
                                                    stopOpacity={0.3}
                                                />
                                                <stop
                                                    offset="95%"
                                                    stopColor="#00D924"
                                                    stopOpacity={0}
                                                />
                                            </linearGradient>
                                            <linearGradient
                                                id="colorNewCustomers"
                                                x1="0"
                                                y1="0"
                                                x2="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="5%"
                                                    stopColor="#00A1FF"
                                                    stopOpacity={0.3}
                                                />
                                                <stop
                                                    offset="95%"
                                                    stopColor="#00A1FF"
                                                    stopOpacity={0}
                                                />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke="#F0F0F0"
                                            vertical={false}
                                        />
                                        <XAxis
                                            dataKey="time"
                                            tickFormatter={formatXAxisLabel}
                                            stroke="#6B7280"
                                            style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 400,
                                            }}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            tickFormatter={value =>
                                                volumeType === 'newCustomers'
                                                    ? value.toString()
                                                    : formatCurrency(value)
                                            }
                                            stroke="#6B7280"
                                            style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 400,
                                            }}
                                            tickLine={false}
                                            axisLine={false}
                                            width={60}
                                        />
                                        <Tooltip
                                            formatter={(value: number) => [
                                                volumeType === 'newCustomers'
                                                    ? value.toString()
                                                    : formatCurrency(value),
                                                volumeType === 'gross'
                                                    ? 'Gross Volume'
                                                    : volumeType === 'net'
                                                      ? 'Net Volume'
                                                      : 'New Customer Onboarding',
                                            ]}
                                            labelFormatter={label => {
                                                return formatTimeLabel(
                                                    label,
                                                    getGroupBy()
                                                );
                                            }}
                                            contentStyle={{
                                                backgroundColor: '#ffffff',
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '8px',
                                                padding: '8px 12px',
                                                boxShadow:
                                                    '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                            }}
                                            labelStyle={{
                                                color: '#6B7280',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                marginBottom: '4px',
                                            }}
                                            itemStyle={{
                                                color: '#111827',
                                                fontSize: '0.875rem',
                                                fontWeight: 600,
                                            }}
                                        />
                                        <Legend
                                            wrapperStyle={{
                                                paddingTop: '20px',
                                                fontSize: '0.875rem',
                                            }}
                                            iconType="line"
                                        />
                                        {volumeType === 'gross' && (
                                            <Area
                                                type="stepAfter"
                                                dataKey="gross"
                                                name="Gross Volume"
                                                stroke="#635BFF"
                                                strokeWidth={2}
                                                fill="url(#colorGross)"
                                                dot={false}
                                                activeDot={{
                                                    r: 4,
                                                    fill: '#635BFF',
                                                    strokeWidth: 2,
                                                    stroke: '#ffffff',
                                                }}
                                            />
                                        )}
                                        {volumeType === 'net' && (
                                            <Area
                                                type="stepAfter"
                                                dataKey="net"
                                                name="Net Volume"
                                                stroke="#00D924"
                                                strokeWidth={2}
                                                fill="url(#colorNet)"
                                                dot={false}
                                                activeDot={{
                                                    r: 4,
                                                    fill: '#00D924',
                                                    strokeWidth: 2,
                                                    stroke: '#ffffff',
                                                }}
                                            />
                                        )}
                                        {volumeType === 'newCustomers' && (
                                            <Area
                                                type="stepAfter"
                                                dataKey="newCustomers"
                                                name="New Customer Onboarding"
                                                stroke="#00A1FF"
                                                strokeWidth={2}
                                                fill="url(#colorNewCustomers)"
                                                dot={false}
                                                activeDot={{
                                                    r: 4,
                                                    fill: '#00A1FF',
                                                    strokeWidth: 2,
                                                    stroke: '#ffffff',
                                                }}
                                            />
                                        )}
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCardContent>
                    </ChartCard>
                </Box>
            </StyledContainer>
        </LocalizationProvider>
    );
};

export default Dashboard;
