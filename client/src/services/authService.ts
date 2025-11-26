import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
    baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: false,
});

// Track if we're currently clearing invalid tokens to prevent loops
let isClearing = false;

// Add request interceptor to include JWT token in Authorization header
api.interceptors.request.use(
    config => {
        // Don't add token if we're currently clearing invalid tokens
        if (!isClearing) {
            const token = localStorage.getItem('authToken');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// Add response interceptor to handle token expiration
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401 && !isClearing) {
            // Token expired or invalid, clear it safely
            clearAuthToken();

            // Redirect to login/refresh page after clearing
            setTimeout(() => {
                window.location.href = '/';
            }, 100);
        }
        return Promise.reject(error);
    }
);

// API endpoints
export const API_ENDPOINTS = {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    VALIDATE_KEYS: '/validate-keys',
};

// Authentication functions
export const login = async (username: string, password: string) => {
    const response = await api.post(API_ENDPOINTS.LOGIN, {
        username,
        password,
    });
    if (response.data.token) {
        // Store JWT token in localStorage
        localStorage.setItem('authToken', response.data.token);
    }
    return response;
};

export const logout = async () => {
    try {
        // Call server logout endpoint (optional)
        await api.post(API_ENDPOINTS.LOGOUT);
    } catch (error) {
        // Even if server logout fails, clear local token
        console.warn('Server logout failed:', error);
    } finally {
        // Always clear local token using our safe method
        clearAuthToken();
    }
};

export const checkAuthStatus = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        throw new Error('No auth token found');
    }
    const response = await api.get(API_ENDPOINTS.ME);
    return response;
};

export const validateKeys = async (encryptedKeys: {
    publicKey: string;
    secretKey: string;
}) => {
    const response = await api.post(API_ENDPOINTS.VALIDATE_KEYS, encryptedKeys);
    return response;
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
    return !!localStorage.getItem('authToken');
};

// Clear authentication token and prevent it from being sent in headers
export const clearAuthToken = () => {
    isClearing = true;
    localStorage.removeItem('authToken');
    localStorage.removeItem('stripePublicKey');
    localStorage.removeItem('stripeSecretKey');
    setTimeout(() => {
        isClearing = false;
    }, 100);
};

export default api;
