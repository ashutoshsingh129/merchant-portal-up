import { Module } from '@nestjs/common';
import { StripeModule } from './stripe/stripe.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [StripeModule, AuthModule],
})
export class ApisModule {}
