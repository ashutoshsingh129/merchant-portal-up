export interface User {
    id?: number;
    stripeId?: string;
    username: string;
    email?: string;
    name?: string;
    passwordHash?: string;
    rawData?: Record<string, any>;
    createdAt?: Date;
    updatedAt?: Date;
}


