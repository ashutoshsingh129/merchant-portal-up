import { Pool } from 'pg';
import * as dotenv from 'dotenv';

console.log('═══════════════════════════════════════════════════════════');
console.log('🗄️  DATABASE CONFIGURATION - STARTING');
console.log('═══════════════════════════════════════════════════════════');

dotenv.config();

const dbConfig = {
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DB || 'stripe_merchant_portal',
  password: process.env.PG_PASS ? '***' : '(empty)',
  port: Number(process.env.PG_PORT) || 5432,
  ssl:
    process.env.NODE_ENV === 'production'
      ? {
          rejectUnauthorized: false,
        }
      : false,
};

console.log('📋 PostgreSQL Pool Configuration:');
console.log('   Host:', dbConfig.host);
console.log('   Port:', dbConfig.port);
console.log('   Database:', dbConfig.database);
console.log('   User:', dbConfig.user);
console.log('   Password:', dbConfig.password);
console.log('   SSL:', !!dbConfig.ssl);
console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');

console.log('🔄 Creating PostgreSQL connection pool...');
export const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DB || 'stripe_merchant_portal',
  password: process.env.PG_PASS || '',
  port: Number(process.env.PG_PORT) || 5432,
  ssl:
    process.env.NODE_ENV === 'production'
      ? {
          rejectUnauthorized: false,
        }
      : false,
});
console.log('✅ PostgreSQL Pool created');

// Test database connection
pool.on('connect', (client) => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ PostgreSQL Pool: NEW CLIENT CONNECTED');
  console.log('   Process ID:', client.processID);
  console.log('═══════════════════════════════════════════════════════════');
});

pool.on('error', (err: Error) => {
  console.error('═══════════════════════════════════════════════════════════');
  console.error('❌ PostgreSQL Pool: CRITICAL ERROR');
  console.error('   Message:', err.message);
  console.error('   Code:', (err as any).code);
  console.error('   Stack:', err.stack);
  console.error('═══════════════════════════════════════════════════════════');
  process.exit(1);
});

// Test connection on startup
export const testDatabaseConnection = async (): Promise<boolean> => {
  const connectionConfig = {
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT) || 5432,
    database: process.env.PG_DB || 'stripe_merchant_portal',
    user: process.env.PG_USER || 'postgres',
  };

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔄 TESTING DATABASE CONNECTION');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    console.log('⏳ Attempting to connect to database...');
    console.log('   Host:', connectionConfig.host);
    console.log('   Port:', connectionConfig.port);
    console.log('   Database:', connectionConfig.database);
    console.log('   User:', connectionConfig.user);

    const startTime = Date.now();
    const client = await pool.connect();
    const connectTime = Date.now() - startTime;

    console.log('✅ Connection established in', connectTime, 'ms');
    console.log('⏳ Executing test query...');

    const result = await client.query(
      'SELECT NOW() as current_time, version() as version',
    );
    client.release();

    const versionParts = result.rows[0].version.split(' ');
    const version = versionParts[0] + ' ' + versionParts[1];

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ DATABASE CONNECTION SUCCESSFUL!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 Database Information:');
    console.log('   Current Time:', result.rows[0].current_time);
    console.log('   Version:', version);
    console.log('   Connection Time:', connectTime + 'ms');
    console.log('═══════════════════════════════════════════════════════════');

    return true;
  } catch (error: any) {
    console.error(
      '═══════════════════════════════════════════════════════════',
    );
    console.error('❌ DATABASE CONNECTION FAILED!');
    console.error(
      '═══════════════════════════════════════════════════════════',
    );
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code || 'N/A');
    console.error('Error Name:', error.name || 'N/A');
    console.error('');
    console.error('Connection Details:');
    console.error('   Host:', connectionConfig.host);
    console.error('   Port:', connectionConfig.port);
    console.error('   Database:', connectionConfig.database);
    console.error('   User:', connectionConfig.user);
    console.error('');
    console.error('Troubleshooting:');
    console.error('   1. Check if PostgreSQL is running');
    console.error('   2. Verify database credentials in .env file');
    console.error('   3. Ensure database exists:', connectionConfig.database);
    console.error(
      '   4. Check network connectivity to',
      connectionConfig.host + ':' + connectionConfig.port,
    );
    console.error('');
    if (error.stack) {
      console.error('Stack Trace:');
      console.error(error.stack);
    }
    console.error(
      '═══════════════════════════════════════════════════════════',
    );
    return false;
  }
};

// Initialize users table if it doesn't exist
export const initializeDatabase = async () => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🗄️  INITIALIZING DATABASE TABLES');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    console.log('⏳ Creating users table...');
    await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                stripe_id VARCHAR(255) UNIQUE,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255),
                name VARCHAR(255),
                password_hash VARCHAR(255) NOT NULL,
                raw_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    console.log('✅ Users table initialized/verified');

    console.log('⏳ Creating stripe_keys table...');
    await pool.query(`
            CREATE TABLE IF NOT EXISTS stripe_keys (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                secret_key TEXT NOT NULL,
                publishable_key VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    console.log('✅ Stripe keys table initialized/verified');

    console.log('⏳ Creating payment_intents table...');
    await pool.query(`
            CREATE TABLE IF NOT EXISTS payment_intents (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                stripe_id VARCHAR(255) UNIQUE NOT NULL,
                stripe_data JSONB NOT NULL,
                amount INTEGER,
                currency VARCHAR(10),
                status VARCHAR(50),
                customer_id VARCHAR(255),
                customer_email VARCHAR(255),
                description TEXT,
                payment_method_type VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                stripe_created_at TIMESTAMP
            )
        `);

    // Create indexes for payment_intents
    // Single column indexes
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_payment_intents_user_id ON payment_intents(user_id)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_payment_intents_stripe_id ON payment_intents(stripe_id)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_payment_intents_currency ON payment_intents(currency)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_payment_intents_customer_id ON payment_intents(customer_id)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_payment_intents_customer_email ON payment_intents(customer_email)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_payment_intents_payment_method_type ON payment_intents(payment_method_type)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_payment_intents_created_at ON payment_intents(created_at)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_payment_intents_stripe_created_at ON payment_intents(stripe_created_at)`,
    );
    
    // Composite indexes for common query patterns
    // Most queries filter by user_id first, then sort by stripe_created_at
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_payment_intents_user_stripe_created_at ON payment_intents(user_id, stripe_created_at DESC)`,
    );
    // Filter by user_id + status (common filter combination)
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_payment_intents_user_status ON payment_intents(user_id, status)`,
    );
    // Filter by user_id + currency (common filter combination)
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_payment_intents_user_currency ON payment_intents(user_id, currency)`,
    );
    // Filter by user_id + status + stripe_created_at (common query pattern)
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_payment_intents_user_status_created ON payment_intents(user_id, status, stripe_created_at DESC)`,
    );
    console.log('✅ Payment intents table initialized/verified');

    // Add application column to payment_intents if it doesn't exist (migration)
    try {
      const columnExists = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='payment_intents' AND column_name='application'
      `);
      if (columnExists.rows.length === 0) {
        console.log('⏳ Adding application column to payment_intents table...');
        await pool.query(`
          ALTER TABLE payment_intents 
          ADD COLUMN application VARCHAR(255)
        `);
        await pool.query(
          `CREATE INDEX IF NOT EXISTS idx_payment_intents_application ON payment_intents(application)`,
        );
        console.log('✅ Added application column to payment_intents table');
      }
    } catch (error: any) {
      console.error('⚠️  Error adding application column to payment_intents:', error.message);
    }

    console.log('⏳ Creating charges table...');
    await pool.query(`
            CREATE TABLE IF NOT EXISTS charges (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                stripe_id VARCHAR(255) UNIQUE NOT NULL,
                stripe_data JSONB NOT NULL,
                amount INTEGER,
                currency VARCHAR(10),
                status VARCHAR(50),
                customer_id VARCHAR(255),
                customer_email VARCHAR(255),
                description TEXT,
                payment_intent_id VARCHAR(255),
                payment_method_type VARCHAR(50),
                amount_refunded INTEGER DEFAULT 0,
                refunded BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                stripe_created_at TIMESTAMP
            )
        `);

    // Create indexes for charges
    // Single column indexes
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_user_id ON charges(user_id)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_stripe_id ON charges(stripe_id)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_status ON charges(status)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_currency ON charges(currency)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_customer_id ON charges(customer_id)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_customer_email ON charges(customer_email)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_payment_intent_id ON charges(payment_intent_id)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_payment_method_type ON charges(payment_method_type)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_refunded ON charges(refunded)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_created_at ON charges(created_at)`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_stripe_created_at ON charges(stripe_created_at)`,
    );
    
    // Composite indexes for common query patterns
    // Most queries filter by user_id first, then sort by stripe_created_at
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_user_stripe_created_at ON charges(user_id, stripe_created_at DESC)`,
    );
    // Filter by user_id + status (common filter combination)
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_user_status ON charges(user_id, status)`,
    );
    // Filter by user_id + currency (common filter combination)
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_user_currency ON charges(user_id, currency)`,
    );
    // Filter by user_id + payment_intent_id (for deduplication lookups)
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_user_payment_intent_id ON charges(user_id, payment_intent_id)`,
    );
    // Filter by user_id + status + stripe_created_at (common query pattern)
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_user_status_created ON charges(user_id, status, stripe_created_at DESC)`,
    );
    // Filter by user_id + refunded (for refunded filter)
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_charges_user_refunded ON charges(user_id, refunded)`,
    );
    console.log('✅ Charges table initialized/verified');

    // Add application column to charges if it doesn't exist (migration)
    try {
      const columnExists = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='charges' AND column_name='application'
      `);
      if (columnExists.rows.length === 0) {
        console.log('⏳ Adding application column to charges table...');
        await pool.query(`
          ALTER TABLE charges 
          ADD COLUMN application VARCHAR(255)
        `);
        await pool.query(
          `CREATE INDEX IF NOT EXISTS idx_charges_application ON charges(application)`,
        );
        console.log('✅ Added application column to charges table');
      }
    } catch (error: any) {
      console.error('⚠️  Error adding application column to charges:', error.message);
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ DATABASE INITIALIZATION COMPLETED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════════');
  } catch (error: any) {
    console.error(
      '═══════════════════════════════════════════════════════════',
    );
    console.error('❌ DATABASE INITIALIZATION FAILED');
    console.error(
      '═══════════════════════════════════════════════════════════',
    );
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code || 'N/A');
    console.error('Error Detail:', error.detail || 'N/A');
    if (error.stack) {
      console.error('Stack Trace:');
      console.error(error.stack);
    }
    console.error(
      '═══════════════════════════════════════════════════════════',
    );
    throw error;
  }
};
