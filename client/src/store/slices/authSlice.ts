import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getEnvironmentConfig } from '../../utils';

const config = getEnvironmentConfig();

interface User {
    id: string;
    email: string;
    name: string;
    username?: string;
    stripeId?: string;
    isMaster?: boolean;
}

interface AuthState {
    isAuthenticated: boolean;
    user: User | null;
    token: string | null;
    isLoading: boolean;
    error: string | null;
    hasStripeKeys: boolean | null; // null means not checked yet
}

const initialState: AuthState = {
    isAuthenticated: false,
    user: null,
    token: localStorage.getItem('authToken'),
    isLoading: false,
    error: null,
    hasStripeKeys: null,
};

// Async thunk for login
export const loginUser = createAsyncThunk(
    'auth/loginUser',
    async (
        credentials: { username: string; password: string },
        { rejectWithValue }
    ) => {
        try {
            const response = await fetch(`${config.API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });

            const data = await response.json();

            if (!response.ok) {
                return rejectWithValue(data.message || 'Login failed');
            }

            // Store token in localStorage
            if (data.token) {
                localStorage.setItem('authToken', data.token);
            }

            return {
                token: data.token,
                user: data.user,
            };
        } catch (error) {
            // Handle network errors and other fetch errors
            if (error instanceof TypeError && error.message.includes('fetch')) {
                return rejectWithValue(
                    'Unable to connect to server. Please check your internet connection.'
                );
            }
            return rejectWithValue(
                error instanceof Error
                    ? error.message
                    : 'Login failed. Please try again.'
            );
        }
    }
);

// Async thunk for logout
export const logoutUser = createAsyncThunk(
    'auth/logoutUser',
    async (_, { rejectWithValue }) => {
        try {
            const token = localStorage.getItem('authToken');

            if (token) {
                await fetch(`${config.API_BASE_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
            }

            // Clear token from localStorage
            localStorage.removeItem('authToken');

            return true;
        } catch (error) {
            // Even if logout fails on server, clear local token
            localStorage.removeItem('authToken');
            return rejectWithValue(
                error instanceof Error ? error.message : 'Logout failed'
            );
        }
    }
);

// Async thunk for verifying token
export const verifyToken = createAsyncThunk(
    'auth/verifyToken',
    async (_, { rejectWithValue }) => {
        try {
            const token = localStorage.getItem('authToken');

            if (!token) {
                return rejectWithValue('No token found');
            }

            const response = await fetch(`${config.API_BASE_URL}/auth/me`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                localStorage.removeItem('authToken');
                return rejectWithValue(
                    data.message || 'Token verification failed'
                );
            }

            return {
                token,
                user: data.user,
            };
        } catch (error) {
            localStorage.removeItem('authToken');
            return rejectWithValue(
                error instanceof Error
                    ? error.message
                    : 'Token verification failed'
            );
        }
    }
);

// Async thunk for checking Stripe keys status
export const checkStripeKeysStatus = createAsyncThunk(
    'auth/checkStripeKeysStatus',
    async (_, { rejectWithValue }) => {
        try {
            const token = localStorage.getItem('authToken');

            if (!token) {
                return rejectWithValue('No authentication token found');
            }

            const response = await fetch(
                `${config.API_BASE_URL}/stripe/keys/status`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('authToken');
                    return rejectWithValue('Authentication required');
                }
                return rejectWithValue(
                    data.message || 'Failed to check keys status'
                );
            }

            return {
                hasKeys: data.hasKeys || false,
            };
        } catch (error) {
            return rejectWithValue(
                error instanceof Error
                    ? error.message
                    : 'Failed to check keys status'
            );
        }
    }
);

// Async thunk for clearing Stripe keys
export const clearKeys = createAsyncThunk(
    'auth/clearKeys',
    async (_, { rejectWithValue }) => {
        try {
            const token = localStorage.getItem('authToken');

            if (!token) {
                return rejectWithValue('No authentication token found');
            }

            const response = await fetch(`${config.API_BASE_URL}/stripe/keys`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('authToken');
                    return rejectWithValue('Authentication required');
                }
                return rejectWithValue(data.message || 'Failed to clear keys');
            }

            return data;
        } catch (error) {
            return rejectWithValue(
                error instanceof Error ? error.message : 'Failed to clear keys'
            );
        }
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        clearError: state => {
            state.error = null;
        },
        clearAuth: state => {
            state.isAuthenticated = false;
            state.user = null;
            state.token = null;
            state.error = null;
            state.hasStripeKeys = null;
            localStorage.removeItem('authToken');
        },
        setStripeKeysStatus: (state, action) => {
            state.hasStripeKeys = action.payload;
        },
    },
    extraReducers: builder => {
        builder
            // Login cases
            .addCase(loginUser.pending, state => {
                state.isLoading = true;
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.isLoading = false;
                state.isAuthenticated = true;
                state.user = action.payload.user;
                state.token = action.payload.token;
                state.error = null;
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.isLoading = false;
                state.isAuthenticated = false;
                state.user = null;
                state.token = null;
                state.error = action.payload as string;
                localStorage.removeItem('authToken');
            })
            // Logout cases
            .addCase(logoutUser.pending, state => {
                state.isLoading = true;
            })
            .addCase(logoutUser.fulfilled, state => {
                state.isLoading = false;
                state.isAuthenticated = false;
                state.user = null;
                state.token = null;
                state.error = null;
                state.hasStripeKeys = null;
            })
            .addCase(logoutUser.rejected, (state, action) => {
                state.isLoading = false;
                state.isAuthenticated = false;
                state.user = null;
                state.token = null;
                state.error = action.payload as string;
                state.hasStripeKeys = null;
            })
            // Verify token cases
            .addCase(verifyToken.pending, state => {
                state.isLoading = true;
            })
            .addCase(verifyToken.fulfilled, (state, action) => {
                state.isLoading = false;
                state.isAuthenticated = true;
                state.user = action.payload.user;
                state.token = action.payload.token;
                state.error = null;
            })
            .addCase(verifyToken.rejected, (state, action) => {
                state.isLoading = false;
                state.isAuthenticated = false;
                state.user = null;
                state.token = null;
                state.error = action.payload as string;
            })
            // Check Stripe keys status cases
            .addCase(checkStripeKeysStatus.pending, state => {
                // Don't set loading to true to avoid blocking UI
            })
            .addCase(checkStripeKeysStatus.fulfilled, (state, action) => {
                state.hasStripeKeys = action.payload.hasKeys;
            })
            .addCase(checkStripeKeysStatus.rejected, (state, action) => {
                state.hasStripeKeys = false;
                // Don't set error here as it's not critical
            })
            // Clear keys cases
            .addCase(clearKeys.pending, state => {
                state.isLoading = true;
            })
            .addCase(clearKeys.fulfilled, state => {
                state.isLoading = false;
                state.hasStripeKeys = false;
                state.error = null;
            })
            .addCase(clearKeys.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            });
    },
});

export const { clearError, clearAuth, setStripeKeysStatus } = authSlice.actions;
export default authSlice.reducer;
