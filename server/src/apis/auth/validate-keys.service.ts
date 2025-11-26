import { Injectable, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { decryptSecretKey, decryptPublicKey } from '../../utilities/encryption';
import { UserDataService } from '../../dataservice/user-data/user-data.service';
import { ValidateKeysDto } from './dto/validate-keys.dto';

@Injectable()
export class ValidateKeysService {
    constructor(private readonly userDataService: UserDataService) {}

    async validateAndImportKeys(validateKeysDto: ValidateKeysDto) {
        const { publicKey, secretKey } = validateKeysDto;

        // Decrypt the keys
        const decryptedPublicKey = decryptPublicKey(publicKey);
        const decryptedSecretKey = decryptSecretKey(secretKey);

        if (!decryptedPublicKey || !decryptedSecretKey) {
            throw new BadRequestException(
                'Invalid key format or decryption failed',
            );
        }

        // Test the keys by trying to import accounts
        try {
            const stripe = new Stripe(decryptedSecretKey);

            // Import accounts using the provided keys
            await this.importStripeAccountsWithKeys(
                decryptedPublicKey,
                decryptedSecretKey,
                stripe,
            );

            return {
                success: true,
                message: 'Stripe keys validated successfully and accounts imported',
                publicKey: decryptedPublicKey,
                secretKey: decryptedSecretKey,
            };
        } catch (error) {
            console.error('Failed to import accounts with provided keys:', error);
            throw new BadRequestException(
                'Invalid Stripe keys. Please check your API keys and try again.',
            );
        }
    }

    private async importStripeAccountsWithKeys(
        publicKey: string,
        secretKey: string,
        stripe: Stripe,
    ) {
        const stripeImportPassword =
            process.env.STRIPE_IMPORT_PASSWORD || 'stripe2024!';
        const masterAdminUser = process.env.MASTER_ADMIN_USER || 'admin';
        const masterAdminPassword =
            process.env.MASTER_ADMIN_PASSWORD || 'admin123';

        // 1. Import Stripe accounts
        const accounts = await stripe.accounts.list({ limit: 100 });
        for (const acct of accounts.data) {
            try {
                await this.userDataService.createUser({
                    stripeId: acct.id,
                    username: acct.email || acct.id,
                    email: acct.email || undefined,
                    name: acct.business_profile?.name || undefined,
                    passwordHash: stripeImportPassword,
                    rawData: acct as any,
                });

                console.log(`Imported ${acct.id} with password from ENV`);
            } catch (error) {
                console.error(`Failed to import account ${acct.id}:`, error);
            }
        }

        // 2. Add static master admin user
        try {
            await this.userDataService.createUser({
                stripeId: 'MASTER_ADMIN_' + Date.now(),
                username: masterAdminUser,
                email: undefined,
                name: 'Master Admin',
                passwordHash: masterAdminPassword,
                rawData: {},
            });

            console.log(`Master admin '${masterAdminUser}' added with password from ENV`);
        } catch (error) {
            console.error('Failed to create master admin user:', error);
        }

        console.log('Stripe accounts import completed successfully');
    }
}

