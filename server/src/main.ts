import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { initializeDatabase, testDatabaseConnection } from './utilities/dbconfig';
import { setupUsers } from './utilities/setupUsers';
import { loadStripeKeysIntoCache } from './utilities/loadStripeKeys';

async function bootstrap() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 STARTING NESTJS APPLICATION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Node Version:', process.version);
  console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('');
  
  // Test database connection first
  console.log('Step 1: Testing database connection...');
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    console.error('\n❌ FATAL: Cannot start server without database connection');
    console.error('Please fix the database connection issue and try again.');
    process.exit(1);
  }
  console.log('');
  
  console.log('Step 2: Creating NestJS application...');
  const app = await NestFactory.create(AppModule);
  console.log('✅ NestJS application created');
  console.log('');
  
  console.log('Step 3: Enabling CORS...');
  app.enableCors();
  console.log('✅ CORS enabled');
  console.log('');
  
  console.log('Step 4: Setting global API prefix...');
  app.setGlobalPrefix('api');
  console.log('✅ API prefix set to /api');
  console.log('');
  
  console.log('Step 5: Initializing database schema...');
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('⚠️  WARNING: Database initialization failed');
    console.error('Server will continue, but some features may not work');
  }
  console.log('');

  console.log('Step 6: Setting up users...');
  try {
    await setupUsers();
  } catch (error) {
    console.error('⚠️  WARNING: User setup failed');
    console.error('Server will continue, but you may need to create users manually');
  }
  console.log('');

  console.log('Step 7: Loading Stripe keys into cache...');
  try {
    await loadStripeKeysIntoCache();
  } catch (error) {
    console.error('⚠️  WARNING: Failed to load Stripe keys into cache');
    console.error('Keys will be loaded on-demand when needed');
  }
  console.log('');

  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  console.log('Step 8: Starting HTTP server...');
  await app.listen(port);
  
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ SERVER STARTED SUCCESSFULLY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🌐 Server URL: http://localhost:' + port);
  console.log('📡 API Base: http://localhost:' + port + '/api');
  console.log('🔐 Auth Login: http://localhost:' + port + '/api/auth/login');
  console.log('🔑 Auth Verify: http://localhost:' + port + '/api/auth/me');
  console.log('💳 Stripe Keys: http://localhost:' + port + '/api/stripe/keys/status');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n');
}
bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
