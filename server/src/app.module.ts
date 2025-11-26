import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApisModule } from './apis/apis.module';
import { Product } from './datastore/models/product';

dotenv.config();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.PG_HOST || 'localhost',
      port: Number(process.env.PG_PORT) || 5432,
      username: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASS || '',
      database: process.env.PG_DB || 'stripe_merchant_portal',
      entities: [Product],
      synchronize: process.env.NODE_ENV !== 'production', // Auto-sync schema in development
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false,
      } : false,
      logging: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'schema'] : ['error'],
      logger: 'advanced-console',
    }),
    ApisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor() {
    console.log('📦 AppModule initialized');
    console.log('🔌 TypeORM configuration:', {
      host: process.env.PG_HOST || 'localhost',
      port: Number(process.env.PG_PORT) || 5432,
      database: process.env.PG_DB || 'stripe_merchant_portal',
      username: process.env.PG_USER || 'postgres',
    });
  }
}
