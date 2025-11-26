import { pool } from './dbconfig';
import { decrypt } from './encryption';
import { stripeKeysCache } from './stripeKeysCache';

/**
 * Load all active Stripe keys from database into cache on startup
 */
export const loadStripeKeysIntoCache = async (): Promise<void> => {
    try {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔄 LOADING STRIPE KEYS INTO CACHE');
        console.log('═══════════════════════════════════════════════════════════');

        const client = await pool.connect();
        try {
            // Load all active Stripe keys for all users
            const result = await client.query(
                'SELECT user_id, secret_key, publishable_key FROM stripe_keys WHERE is_active = true'
            );

            if (result.rows.length > 0) {
                let loadedCount = 0;
                for (const row of result.rows) {
                    const {
                        user_id,
                        secret_key: encryptedSecretKey,
                        publishable_key,
                    } = row;
                    // Decrypt the secret key before caching
                    const decryptedSecretKey = decrypt(encryptedSecretKey);
                    // Update cache with user-specific keys
                    stripeKeysCache.updateKeys(
                        user_id,
                        decryptedSecretKey,
                        publishable_key
                    );
                    loadedCount++;
                }
                console.log(`✅ Stripe keys loaded into cache for ${loadedCount} user(s)`);
            } else {
                console.log('ℹ️  No active Stripe keys found in database');
            }
            console.log('═══════════════════════════════════════════════════════════\n');
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('⚠️  Error loading keys into cache:', error.message);
        console.error('Server will continue, but keys will be loaded on-demand\n');
        // Don't fail server startup if keys can't be loaded
    }
};

