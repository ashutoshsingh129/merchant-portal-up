import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { StripeKeysService } from './stripe-keys.service';
import { StripeSyncService } from './stripe-sync.service';
import { StripeDbService } from './stripe-db.service';
import { PaymentIntent } from '../../datastore/models/payment-intent.model';
import { Charge } from '../../datastore/models/charge.model';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentIntent, Charge])],
  controllers: [StripeController],
  providers: [
    StripeService,
    StripeKeysService,
    StripeSyncService,
    StripeDbService,
  ],
  exports: [StripeKeysService, StripeSyncService, StripeDbService],
})
export class StripeModule {}
