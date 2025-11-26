import React, { useEffect } from 'react';
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate,
    Outlet,
} from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box, CircularProgress, Typography } from '@mui/material';
import { Provider } from 'react-redux';
import { store } from './store';
import { useAppSelector, useAppDispatch } from './store';
import { lightTheme, darkTheme } from './theme';
import { verifyToken, checkStripeKeysStatus } from './store/slices/authSlice';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Dashboard/Dashboard';
import Payments from './components/Payments';
import TransactionDetail from './components/Payments/TransactionDetail';
import Payouts from './components/Payouts';
import Customers from './components/Customers';
import { LoginForm, StripeKeysForm, ProtectedRoute } from './components/Auth';

const AppRoutes: React.FC = () => {
    const dispatch = useAppDispatch();
    const theme = useAppSelector(state => state.app.theme);
    const { isAuthenticated, isLoading, hasStripeKeys } = useAppSelector(
        state => state.auth
    );
    const currentTheme = theme === 'dark' ? darkTheme : lightTheme;

    useEffect(() => {
        // Check if user is authenticated on app load
        const token = localStorage.getItem('authToken');
        if (token && !isAuthenticated) {
            dispatch(verifyToken());
        }
    }, [dispatch, isAuthenticated]);

    useEffect(() => {
        // Check Stripe keys status after authentication
        if (isAuthenticated && hasStripeKeys === null) {
            dispatch(checkStripeKeysStatus());
        }
    }, [dispatch, isAuthenticated, hasStripeKeys]);

    // Show loading while checking authentication
    if (isLoading) {
        return (
            <ThemeProvider theme={currentTheme}>
                <CssBaseline />
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100vh',
                        gap: 2,
                    }}
                >
                    <CircularProgress />
                    <Typography>Loading...</Typography>
                </Box>
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider theme={currentTheme}>
            <CssBaseline />
            <Router>
                <Routes>
                    {/* Login route - redirect to dashboard if already authenticated */}
                    <Route
                        path="/login"
                        element={
                            isAuthenticated ? (
                                <Navigate to="/dashboard" replace />
                            ) : (
                                <LoginForm />
                            )
                        }
                    />
                    {/* Stripe Keys route - only accessible if authenticated but keys not configured */}
                    <Route
                        path="/stripe-keys"
                        element={
                            !isAuthenticated ? (
                                <Navigate to="/login" replace />
                            ) : hasStripeKeys ? (
                                <Navigate to="/dashboard" replace />
                            ) : (
                                <StripeKeysForm
                                    onSuccess={() => {
                                        // After keys are saved, check status again
                                        dispatch(checkStripeKeysStatus());
                                    }}
                                />
                            )
                        }
                    />
                    {/* Protected routes - require authentication and Stripe keys */}
                    <Route
                        element={
                            <ProtectedRoute>
                                {isAuthenticated && hasStripeKeys === false ? (
                                    <Navigate to="/stripe-keys" replace />
                                ) : (
                                    <Layout>
                                        <Outlet />
                                    </Layout>
                                )}
                            </ProtectedRoute>
                        }
                    >
                        <Route
                            path="/"
                            element={<Navigate to="/dashboard" replace />}
                        />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/payments" element={<Payments />} />
                        <Route
                            path="/payments/:id"
                            element={<TransactionDetail />}
                        />
                        <Route
                            path="/transactions/:id"
                            element={<TransactionDetail />}
                        />
                        <Route
                            path="/transactions/payouts"
                            element={<Payouts />}
                        />
                        <Route path="/payouts" element={<Payouts />} />
                        <Route path="/customers" element={<Customers />} />
                    </Route>
                </Routes>
            </Router>
        </ThemeProvider>
    );
};

const App: React.FC = () => {
    return (
        <Provider store={store}>
            <AppRoutes />
        </Provider>
    );
};

export default App;
