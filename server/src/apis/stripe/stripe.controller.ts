import { Controller, Get, Param, Query, Post, Body } from '@nestjs/common';
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

  // NEW OPTIMIZED ENDPOINTS FOR FAST LOADING
  
  @Get('transactions-fast')
  getTransactionsFast(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('account') account?: string,
  ) {
    return this.stripeService.getTransactionsFast({
      limit: limit ? parseInt(limit) : undefined,
      page: page ? parseInt(page) : undefined,
      account,
    });
  }

  @Get('all-transactions-fast')
  getAllTransactionsFast(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('status') status?: string,
    @Query('days') days?: string,
    @Query('amount') amount?: string,
    @Query('amountOperator') amountOperator?: string,
    @Query('currency') currency?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    return this.stripeService.getAllTransactionsFast({
      limit: limit ? parseInt(limit) : undefined,
      page: page ? parseInt(page) : undefined,
      status: status,
      days: days ? parseInt(days) : undefined,
      amount: amount ? parseFloat(amount) : undefined,
      amountOperator: amountOperator,
      currency: currency,
      paymentMethod: paymentMethod,
    });
  }

  @Get('all-payouts-fast')
  getAllPayoutsFast(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('status') status?: string,
  ) {
    return this.stripeService.getAllPayoutsFast({
      limit: limit ? parseInt(limit) : undefined,
      page: page ? parseInt(page) : undefined,
      status: status,
    });
  }

  @Get('payouts-fast')
  getPayoutsFast(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('account') account?: string,
  ) {
    return this.stripeService.getPayoutsFast({
      limit: limit ? parseInt(limit) : undefined,
      page: page ? parseInt(page) : undefined,
      account,
    });
  }

  @Get('summary-fast')
  getSummaryFast(
    @Query('account') account?: string,
  ) {
    return this.stripeService.getSummaryFast(account);
  }

  @Get('accounts-fast')
  getAccountsFast() {
    return this.stripeService.getAccountsFast();
  }

  @Get('all-customers-fast')
  getAllCustomersFast(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.stripeService.getAllCustomersFast({
      limit: limit ? parseInt(limit) : undefined,
      page: page ? parseInt(page) : undefined,
    });
  }

  @Post('clear-cache')
  clearCache(@Body() body: { pattern?: string }) {
    this.stripeService.clearCache(body.pattern);
    return { message: 'Cache cleared successfully' };
  }

  @Get('volume-data')
  getVolumeData(
    @Query('days') days?: string,
    @Query('groupBy') groupBy?: 'hour' | 'day',
    @Query('date') date?: string,
  ) {
    return this.stripeService.getVolumeData({
      days: days ? parseInt(days) : undefined,
      groupBy,
      date: date ? new Date(date) : undefined,
    });
  }
}


