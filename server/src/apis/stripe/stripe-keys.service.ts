import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { pool } from '../../utilities/dbconfig';
import { simpleEncrypt, simpleDecrypt } from '../../utilities/encryption';
import { stripeKeysCache } from '../../utilities/stripeKeysCache';
import Stripe from 'stripe';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'stripe-connect-2025';

// Validate Stripe key format
const validateStripeKey = (key: string, type: 'secret' | 'publishable'): boolean => {
    if (!key || typeof key !== 'string') {
        return false;
    }

    const trimmedKey = key.trim();

    if (type === 'secret') {
        return trimmedKey.startsWith('sk_test_') || trimmedKey.startsWith('sk_live_');
    } else if (type === 'publishable') {
        return trimmedKey.startsWith('pk_test_') || trimmedKey.startsWith('pk_live_');
    }

    return false;
};

// Validate Stripe keys by making a test API call
const validateStripeKeysWithAPI = async (
    secretKey: string,
    publishableKey: string,
): Promise<{
    isValid: boolean;
    accountId?: string;
    accountType?: string;
    country?: string;
    error?: string;
    message?: string;
}> => {
    try {
        const stripe = new Stripe(secretKey);

        // Make a simple API call to validate the keys
        const account = await stripe.accounts.retrieve();

        // Check if the account is accessible
        if (account && account.id) {
            return {
                isValid: true,
                accountId: account.id,
                accountType: account.type || undefined,
                country: account.country || undefined,
                message: 'Keys are valid and account is accessible',
            };
        } else {
            return {
                isValid: false,
                error: 'Account not accessible with provided keys',
                message: 'The provided keys do not have access to a valid Stripe account',
            };
        }
    } catch (error: any) {
        console.error('Stripe API validation error:', error);

        // Handle specific Stripe errors
        if (error.type === 'StripeAuthenticationError') {
            return {
                isValid: false,
                error: 'Authentication failed',
                message: 'Invalid secret key. Please check your Stripe secret key.',
            };
        } else if (error.type === 'StripePermissionError') {
            return {
                isValid: false,
                error: 'Permission denied',
                message: 'The provided keys do not have sufficient permissions.',
            };
        } else if (error.type === 'StripeAPIError') {
            return {
                isValid: false,
                error: 'API error',
                message: 'Stripe API error: ' + error.message,
            };
        } else {
            return {
                isValid: false,
                error: 'Validation failed',
                message: 'Unable to validate keys: ' + error.message,
            };
        }
    }
};

@Injectable()
export class StripeKeysService {
    // Store Stripe keys for a user
    async storeKeys(userId: number, secretKey: string, publishableKey: string) {
        // Validate input
        if (!secretKey || !publishableKey) {
            throw new BadRequestException('Both secret_key and publishable_key are required');
        }

        // Validate key formats
        if (!validateStripeKey(secretKey, 'secret')) {
            throw new BadRequestException('Secret key must start with sk_test_ or sk_live_');
        }

        if (!validateStripeKey(publishableKey, 'publishable')) {
            throw new BadRequestException('Publishable key must start with pk_test_ or pk_live_');
        }

        // Validate keys with Stripe API
        const validationResult = await validateStripeKeysWithAPI(
            secretKey.trim(),
            publishableKey.trim(),
        );

        if (!validationResult.isValid) {
            throw new BadRequestException(
                validationResult.message || 'The provided Stripe keys are invalid or not accessible',
            );
        }

        // Encrypt the secret key before storing
        const encryptedSecretKey = simpleEncrypt(secretKey.trim(), ENCRYPTION_KEY);

        const client = await pool.connect();

        try {
            // Start transaction
            await client.query('BEGIN');

            // Deactivate existing keys for this user
            await client.query(
                'UPDATE stripe_keys SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND is_active = true',
                [userId],
            );

            // Insert new keys (secret_key encrypted, publishable_key plain)
            const result = await client.query(
                'INSERT INTO stripe_keys (user_id, secret_key, publishable_key) VALUES ($1, $2, $3) RETURNING id, created_at',
                [userId, encryptedSecretKey, publishableKey.trim()],
            );

            // Commit transaction
            await client.query('COMMIT');

            // Update cache with decrypted secret key and plain publishable key
            stripeKeysCache.updateKeys(userId, secretKey.trim(), publishableKey.trim());

            return {
                success: true,
                message: 'Stripe keys saved successfully',
                data: {
                    id: result.rows[0].id,
                    created_at: result.rows[0].created_at,
                    validation: {
                        account_id: validationResult.accountId,
                        account_type: validationResult.accountType,
                        country: validationResult.country,
                    },
                },
            };
        } catch (error: any) {
            // Rollback transaction
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Check if keys exist for a user
    async checkKeysStatus(userId: number) {
        const client = await pool.connect();

        try {
            const result = await client.query(
                'SELECT COUNT(*) as count FROM stripe_keys WHERE user_id = $1 AND is_active = true',
                [userId],
            );

            const hasKeys = parseInt(result.rows[0].count) > 0;

            return {
                success: true,
                hasKeys,
                message: hasKeys
                    ? 'Keys are configured for this user'
                    : 'No keys configured for this user',
            };
        } finally {
            client.release();
        }
    }

    // Get keys for a user (without secret key)
    async getKeys(userId: number) {
        const client = await pool.connect();

        try {
            const result = await client.query(
                'SELECT id, publishable_key, created_at, updated_at FROM stripe_keys WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
                [userId],
            );

            if (result.rows.length === 0) {
                return {
                    success: true,
                    message: 'No active Stripe keys found for this user',
                    data: null,
                    hasKeys: false,
                };
            }

            return {
                success: true,
                data: {
                    id: result.rows[0].id,
                    publishable_key: result.rows[0].publishable_key,
                    created_at: result.rows[0].created_at,
                    updated_at: result.rows[0].updated_at,
                },
                hasKeys: true,
            };
        } finally {
            client.release();
        }
    }

    // Delete keys for a user
    async deleteKeys(userId: number) {
        const client = await pool.connect();

        try {
            // Start transaction
            await client.query('BEGIN');

            // Delete keys for this user only
            const result = await client.query('DELETE FROM stripe_keys WHERE user_id = $1', [
                userId,
            ]);

            // Commit transaction
            await client.query('COMMIT');

            // Clear cache for this user
            stripeKeysCache.clearUserCache(userId);

            return {
                success: true,
                message: 'Stripe keys cleared successfully for this user',
                data: {
                    deleted_count: result.rowCount,
                },
            };
        } catch (error: any) {
            // Rollback transaction
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

