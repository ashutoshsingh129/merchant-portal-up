import React, { useState, useEffect } from 'react';
import { checkAuthStatus, clearAuthToken } from '../../services/authService';
import { LoginForm, StripeKeysForm } from './index';

interface AuthWrapperProps {
    onAuthSuccess: (user: any) => void;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ onAuthSuccess }) => {
    const [currentStep, setCurrentStep] = useState<'stripe-keys' | 'login'>(
        'stripe-keys'
    );
    const [stripeKeys, setStripeKeys] = useState<{
        publicKey: string;
        secretKey: string;
    } | null>(null);
    const [isCheckingSetup, setIsCheckingSetup] = useState(true);

    // Check if user has already completed setup
    useEffect(() => {
        const checkSetupStatus = async () => {
            const storedPublicKey = localStorage.getItem('stripePublicKey');
            const storedSecretKey = localStorage.getItem('stripeSecretKey');
            const authToken = localStorage.getItem('authToken');

            if (storedPublicKey && storedSecretKey && authToken) {
                // User has completed setup, check if token is still valid
                setStripeKeys({
                    publicKey: storedPublicKey,
                    secretKey: storedSecretKey,
                });

                try {
                    // Validate the existing token
                    const response = await checkAuthStatus();
                    if (response.data && response.data.user) {
                        // Token is valid, go directly to dashboard
                        onAuthSuccess(response.data.user);
                        return;
                    } else {
                        // Token is invalid, go to login
                        setCurrentStep('login');
                    }
                } catch (error) {
                    console.log(
                        'Token validation failed, redirecting to login:',
                        error
                    );
                    // Token is invalid, go to login
                    setCurrentStep('login');
                }
            } else if (storedPublicKey && storedSecretKey) {
                // User has keys but no auth token
                setStripeKeys({
                    publicKey: storedPublicKey,
                    secretKey: storedSecretKey,
                });
                setCurrentStep('login');
            } else {
                // User needs to start from beginning
                setCurrentStep('stripe-keys');
            }
            setIsCheckingSetup(false);
        };

        checkSetupStatus();
    }, [onAuthSuccess]);

    // Handle Stripe keys validation success
    const handleKeysValidated = (publicKey: string, secretKey: string) => {
        setStripeKeys({ publicKey, secretKey });
        setCurrentStep('login');
    };

    // Handle login success
    const handleLoginSuccess = (userData: any) => {
        onAuthSuccess(userData);
    };

    // Show loading spinner while checking setup status
    if (isCheckingSetup) {
        return (
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                }}
            >
                <div>Loading...</div>
            </div>
        );
    }

    // Render appropriate component based on current step
    if (currentStep === 'stripe-keys') {
        return <StripeKeysForm onKeysValidated={handleKeysValidated} />;
    }

    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
};

export default AuthWrapper;
