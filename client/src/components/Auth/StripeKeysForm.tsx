import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    TextField,
    Button,
    Typography,
    Alert,
    CircularProgress,
    InputAdornment,
    IconButton,
    Container,
} from '@mui/material';
import { Visibility, VisibilityOff, Save, Security } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { getEnvironmentConfig } from '../../utils';
import AuthHeader from './AuthHeader';

const config = getEnvironmentConfig();

const StyledContainer = styled(Container)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
}));

const StyledCard = styled(Card)(({ theme }) => ({
    maxWidth: 600,
    width: '100%',
    boxShadow:
        theme.palette.mode === 'dark'
            ? '0 8px 32px rgba(0, 0, 0, 0.5)'
            : '0 8px 32px rgba(0, 0, 0, 0.1)',
    borderRadius: 16,
    backdropFilter: 'blur(10px)',
    background:
        theme.palette.mode === 'dark'
            ? 'rgba(30, 30, 30, 0.95)'
            : 'rgba(255, 255, 255, 0.95)',
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
    marginBottom: theme.spacing(2),
}));

interface StripeKeysFormProps {
    onSuccess?: () => void;
    onError?: (error: string) => void;
}

interface FormData {
    secretKey: string;
    publishableKey: string;
}

const StripeKeysForm: React.FC<StripeKeysFormProps> = ({
    onSuccess,
    onError,
}) => {
    const [formData, setFormData] = useState<FormData>({
        secretKey: '',
        publishableKey: '',
    });
    const [showSecretKey, setShowSecretKey] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleInputChange =
        (field: keyof FormData) =>
        (event: React.ChangeEvent<HTMLInputElement>) => {
            setFormData(prev => ({
                ...prev,
                [field]: event.target.value,
            }));
            // Clear error when user starts typing
            if (error) setError(null);
            if (success) setSuccess(null);
        };

    const toggleSecretKeyVisibility = () => {
        setShowSecretKey(prev => !prev);
    };

    const validateForm = (): boolean => {
        if (!formData.secretKey.trim()) {
            setError('Secret key is required');
            return false;
        }
        if (!formData.publishableKey.trim()) {
            setError('Publishable key is required');
            return false;
        }

        // Basic validation for Stripe keys
        if (!formData.secretKey.startsWith('sk_')) {
            setError('Secret key must start with "sk_"');
            return false;
        }
        if (!formData.publishableKey.startsWith('pk_')) {
            setError('Publishable key must start with "pk_"');
            return false;
        }

        return true;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                setError('Authentication required. Please login again.');
                onError?.('Authentication required');
                return;
            }

            const response = await fetch(`${config.API_BASE_URL}/stripe/keys`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    secret_key: formData.secretKey.trim(),
                    publishable_key: formData.publishableKey.trim(),
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                let errorMessage =
                    result.message || 'Failed to save Stripe keys';

                if (response.status === 401) {
                    localStorage.removeItem('authToken');
                    errorMessage =
                        'Authentication required. Please login again.';
                } else if (result.error === 'Authentication failed') {
                    errorMessage =
                        'Invalid secret key. Please check your Stripe secret key.';
                } else if (result.error === 'Permission denied') {
                    errorMessage =
                        'The provided keys do not have sufficient permissions.';
                } else if (result.error === 'API error') {
                    errorMessage = 'Stripe API error. Please try again later.';
                } else if (result.error === 'Invalid secret key format') {
                    errorMessage =
                        'Secret key must start with sk_test_ or sk_live_';
                } else if (result.error === 'Invalid publishable key format') {
                    errorMessage =
                        'Publishable key must start with pk_test_ or pk_live_';
                }

                setError(errorMessage);
                onError?.(errorMessage);
            } else {
                setSuccess(
                    'Stripe keys saved successfully! All future API calls will use these keys.'
                );
                setFormData({ secretKey: '', publishableKey: '' });
                onSuccess?.();
            }
        } catch (err) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : 'An unexpected error occurred';
            setError(errorMessage);
            onError?.(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
            }}
        >
            <AuthHeader showConfigureKeys={true} currentPage="stripe-keys" />
            <StyledContainer>
                <StyledCard>
                    <CardContent>
                        <Box
                            display="flex"
                            alignItems="center"
                            marginBottom={3}
                        >
                            <Security color="primary" sx={{ marginRight: 1 }} />
                            <Typography variant="h5" component="h2">
                                Configure Stripe Keys
                            </Typography>
                        </Box>

                        <Typography
                            variant="body2"
                            color="text.secondary"
                            marginBottom={3}
                        >
                            Enter your Stripe API keys to configure the system.
                            Secret keys are encrypted using AES-256-CBC before
                            storage. HTTPS ensures data is encrypted in transit.
                        </Typography>

                        {error && (
                            <Alert severity="error" sx={{ marginBottom: 2 }}>
                                {error}
                            </Alert>
                        )}

                        {success && (
                            <Alert severity="success" sx={{ marginBottom: 2 }}>
                                {success}
                            </Alert>
                        )}

                        <form onSubmit={handleSubmit}>
                            <StyledTextField
                                fullWidth
                                label="Secret Key"
                                type={showSecretKey ? 'text' : 'password'}
                                value={formData.secretKey}
                                onChange={handleInputChange('secretKey')}
                                placeholder="sk_test_..."
                                disabled={loading}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                aria-label="toggle secret key visibility"
                                                onClick={
                                                    toggleSecretKeyVisibility
                                                }
                                                edge="end"
                                                disabled={loading}
                                            >
                                                {showSecretKey ? (
                                                    <VisibilityOff />
                                                ) : (
                                                    <Visibility />
                                                )}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                                helperText="Your Stripe secret key (starts with sk_)"
                            />

                            <StyledTextField
                                fullWidth
                                label="Publishable Key"
                                type="text"
                                value={formData.publishableKey}
                                onChange={handleInputChange('publishableKey')}
                                placeholder="pk_test_..."
                                disabled={loading}
                                helperText="Your Stripe publishable key (starts with pk_)"
                            />

                            <Box
                                display="flex"
                                justifyContent="flex-end"
                                marginTop={3}
                            >
                                <Button
                                    type="submit"
                                    variant="contained"
                                    startIcon={
                                        loading ? (
                                            <CircularProgress size={20} />
                                        ) : (
                                            <Save />
                                        )
                                    }
                                    disabled={
                                        loading ||
                                        !formData.secretKey.trim() ||
                                        !formData.publishableKey.trim()
                                    }
                                    size="large"
                                >
                                    {loading ? 'Saving...' : 'Save Keys'}
                                </Button>
                            </Box>
                        </form>

                        <Box marginTop={3}>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                <strong>Security Note:</strong> Secret keys are
                                encrypted using AES-256-CBC with a server-side
                                encryption key before being stored in the
                                database. HTTPS ensures data is encrypted in
                                transit. Keys are cached in memory for optimal
                                performance.
                            </Typography>
                        </Box>
                    </CardContent>
                </StyledCard>
            </StyledContainer>
        </Box>
    );
};

export default StripeKeysForm;
