import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    TextField,
    Button,
    Typography,
    Alert,
    CircularProgress,
    Container,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store';
import { loginUser, clearError } from '../../store/slices/authSlice';
import { styled } from '@mui/material/styles';
import AuthHeader from './AuthHeader';

const StyledLoginContainer = styled(Container)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
}));

const StyledCard = styled(Card)(({ theme }) => ({
    maxWidth: 400,
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

const StyledForm = styled('form')(({ theme }) => ({
    width: '100%',
}));

const LoginForm: React.FC = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { isLoading, error, isAuthenticated } = useAppSelector(
        state => state.auth
    );

    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });

    // Redirect to dashboard if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const [validationErrors, setValidationErrors] = useState({
        username: '',
        password: '',
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));

        // Clear validation error for this field
        if (validationErrors[name as keyof typeof validationErrors]) {
            setValidationErrors(prev => ({
                ...prev,
                [name]: '',
            }));
        }
    };

    const validateForm = () => {
        const errors = {
            username: '',
            password: '',
        };

        if (!formData.username.trim()) {
            errors.username = 'Username is required';
        }

        if (!formData.password.trim()) {
            errors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            errors.password = 'Password must be at least 6 characters';
        }

        setValidationErrors(errors);
        return !errors.username && !errors.password;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        try {
            await dispatch(loginUser(formData)).unwrap();
        } catch (error) {
            // Error is handled by the auth slice and will be displayed in the UI
            console.error('Login failed:', error);
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
            <AuthHeader showConfigureKeys={true} currentPage="login" />
            <StyledLoginContainer>
                <StyledCard>
                    <CardContent>
                        <Box textAlign="center" mb={3}>
                            <Typography
                                variant="h4"
                                component="h1"
                                gutterBottom
                            >
                                Merchant Portal
                            </Typography>
                            <Typography variant="h6" color="text.secondary">
                                Sign in to your account
                            </Typography>
                        </Box>

                        {error && (
                            <Alert
                                severity="error"
                                sx={{ mb: 2 }}
                                onClose={() => dispatch(clearError())}
                            >
                                {error}
                            </Alert>
                        )}

                        <StyledForm onSubmit={handleSubmit}>
                            <TextField
                                fullWidth
                                label="Username"
                                name="username"
                                type="text"
                                value={formData.username}
                                onChange={handleInputChange}
                                error={!!validationErrors.username}
                                helperText={validationErrors.username}
                                disabled={isLoading}
                                margin="normal"
                                autoComplete="username"
                                autoFocus
                            />

                            <TextField
                                fullWidth
                                label="Password"
                                name="password"
                                type="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                error={!!validationErrors.password}
                                helperText={validationErrors.password}
                                disabled={isLoading}
                                margin="normal"
                                autoComplete="current-password"
                            />

                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                size="large"
                                disabled={isLoading}
                                sx={{ mt: 3, mb: 2 }}
                            >
                                {isLoading ? (
                                    <CircularProgress
                                        size={24}
                                        color="inherit"
                                    />
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </StyledForm>
                    </CardContent>
                </StyledCard>
            </StyledLoginContainer>
        </Box>
    );
};

export default LoginForm;
