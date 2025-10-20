export const getEnvironmentConfig = () => {
    return {
        API_BASE_URL:
            process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api',
        ENVIRONMENT: process.env.REACT_APP_ENVIRONMENT || 'development',
        APP_NAME: process.env.REACT_APP_APP_NAME || 'React Template FE',
        VERSION: process.env.REACT_APP_VERSION || '1.0.0',
    };
};

export const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
};
