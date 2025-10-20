export interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
}

export interface TableColumn {
    id: string;
    label: string;
    minWidth?: number;
    align?: 'right' | 'left' | 'center';
    format?: (value: any) => string;
}

export interface ApiResponse<T> {
    data: T;
    message: string;
    success: boolean;
}

export interface EnvironmentConfig {
    API_BASE_URL: string;
    ENVIRONMENT: string;
    APP_NAME: string;
    VERSION: string;
}
