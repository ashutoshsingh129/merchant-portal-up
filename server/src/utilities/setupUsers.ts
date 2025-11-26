import * as bcrypt from 'bcryptjs';
import { pool } from './dbconfig';

interface UserToCreate {
    username: string;
    email?: string;
    name: string;
    password: string;
    stripeId?: string;
}

// Setup users on startup
export const setupUsers = async (): Promise<void> => {
    const client = await pool.connect();

    try {
        // Start transaction
        await client.query('BEGIN');

        // Define users to create (same as Merchant-onboarding)
        const usersToCreate: UserToCreate[] = [
            {
                username: 'sal@simplypaymentsgroup.com',
                email: 'sal@simplypaymentsgroup.com',
                name: 'Salvador',
                password: 'stripe2025!',
            },
            {
                username: 'dmitry@simplypaymentsgroup.com',
                email: 'dmitry@simplypaymentsgroup.com',
                name: 'Dmitry',
                password: 'stripe2025!',
            },
            {
                username: 'user@simplypaymentsgroup.com',
                email: 'user@simplypaymentsgroup.com',
                name: 'User',
                password: 'stripe2025!',
            },
        ];

        // Also check for users from environment variables
        const masterAdminUser = process.env.MASTER_ADMIN_USER || 'admin';
        const masterAdminPassword = process.env.MASTER_ADMIN_PASSWORD || 'admin123';
        
        // Add master admin if not already in the list
        if (!usersToCreate.find(u => u.username === masterAdminUser)) {
            usersToCreate.push({
                username: masterAdminUser,
                name: 'Master Admin',
                password: masterAdminPassword,
                stripeId: 'MASTER_ADMIN_' + Date.now(),
            });
        }

        let createdCount = 0;
        let existingCount = 0;
        let errorCount = 0;

        console.log('═══════════════════════════════════════════════════════════');
        console.log('👥 SETTING UP USERS');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`📋 Found ${usersToCreate.length} users to setup\n`);

        for (const userData of usersToCreate) {
            try {
                // Check if user already exists by username
                const existingUser = await client.query(
                    'SELECT id, username FROM users WHERE username = $1',
                    [userData.username]
                );

                if (existingUser.rows.length === 0) {
                    // Hash the password
                    const hashedPassword = await bcrypt.hash(userData.password, 10);

                    // Insert user
                    await client.query(
                        `INSERT INTO users (username, email, name, password_hash, stripe_id, raw_data) 
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [
                            userData.username,
                            userData.email || null,
                            userData.name,
                            hashedPassword,
                            userData.stripeId || null,
                            null,
                        ]
                    );

                    console.log(`✅ User created: ${userData.username} (${userData.name})`);
                    createdCount++;
                } else {
                    console.log(`ℹ️  User already exists: ${userData.username}`);
                    existingCount++;
                }
            } catch (error: any) {
                console.error(`❌ Failed to create user ${userData.username}:`, error.message);
                errorCount++;
            }
        }

        // Commit transaction
        await client.query('COMMIT');

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📊 USER SETUP SUMMARY');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`   ✅ Created: ${createdCount} users`);
        console.log(`   ℹ️  Already existed: ${existingCount} users`);
        if (errorCount > 0) {
            console.log(`   ❌ Errors: ${errorCount} users`);
        }
        console.log('\n🔑 Login Credentials:');
        console.log('   - sal@simplypaymentsgroup.com / stripe2025!');
        console.log('   - dmitry@simplypaymentsgroup.com / stripe2025!');
        console.log('   - user@simplypaymentsgroup.com / stripe2025!');
        if (masterAdminUser) {
            console.log(`   - ${masterAdminUser} / ${masterAdminPassword}`);
        }
        console.log('═══════════════════════════════════════════════════════════\n');
    } catch (error: any) {
        // Rollback transaction
        await client.query('ROLLBACK');
        console.error('═══════════════════════════════════════════════════════════');
        console.error('❌ ERROR SETTING UP USERS');
        console.error('═══════════════════════════════════════════════════════════');
        console.error('Error:', error.message);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
        console.error('═══════════════════════════════════════════════════════════\n');
        throw error;
    } finally {
        client.release();
    }
};

