import { Controller, Get, Param, Query } from '@nestjs/common';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Get('transactions')
  listTransactions(
    @Query('limit') limit?: string,
    @Query('starting_after') starting_after?: string,
    @Query('ending_before') ending_before?: string,
    @Query('customer') customer?: string,
  ) {
    return this.stripeService.listTransactions({
      limit: limit ? parseInt(limit) : undefined,
      starting_after,
      ending_before,
      customer,
    });
  }

  @Get('transactions/:id')
  getTransaction(@Param('id') id: string) {
    return this.stripeService.getTransaction(id);
  }

  @Get('transactions-with-summary')
  listTransactionsWithSummary(
    @Query('limit') limit?: string,
    @Query('starting_after') starting_after?: string,
    @Query('ending_before') ending_before?: string,
    @Query('customer') customer?: string,
  ) {
    return this.stripeService.listTransactionsWithSummary({
      limit: limit ? parseInt(limit) : undefined,
      starting_after,
      ending_before,
      customer,
    });
  }

  @Get('all-transactions')
  getAllTransactions(
    @Query('limit') limit?: string,
  ) {
    return this.stripeService.getAllTransactionsWithSummary({
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('accounts')
  getAccounts() {
    return this.stripeService.getConnectedAccounts();
  }

  @Get('payouts')
  listPayouts(
    @Query('limit') limit?: string,
    @Query('starting_after') starting_after?: string,
    @Query('ending_before') ending_before?: string,
  ) {
    return this.stripeService.listPayouts({
      limit: limit ? parseInt(limit) : undefined,
      starting_after,
      ending_before,
    });
  }

  @Get('payouts/:id')
  getPayout(@Param('id') id: string) {
    return this.stripeService.getPayout(id);
  }

  @Get('all-payouts')
  getAllPayouts(
    @Query('limit') limit?: string,
  ) {
    return this.stripeService.getAllPayoutsWithSummary({
      limit: limit ? parseInt(limit) : undefined,
    });
  }
}


