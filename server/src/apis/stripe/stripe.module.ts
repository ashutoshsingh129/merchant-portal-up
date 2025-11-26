import { Module } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { StripeKeysService } from './stripe-keys.service';

@Module({
  controllers: [StripeController],
  providers: [StripeService, StripeKeysService],
  exports: [StripeKeysService],
})
export class StripeModule {}


