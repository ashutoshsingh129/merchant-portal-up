import {
    Controller,
    Get,
    Param,
    Query,
    Post,
    Body,
    Delete,
    HttpException,
    HttpStatus,
    UseGuards,
    Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StripeService } from './stripe.service';
import { StripeKeysService } from './stripe-keys.service';

@Controller('stripe')
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly stripeKeysService: StripeKeysService,
  ) {}

  // Helper to get userId from request
  private getUserId(req: any): number {
    return req.user?.id;
  }

  @Get('transactions')
  @UseGuards(AuthGuard('jwt'))
  listTransactions(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('starting_after') starting_after?: string,
    @Query('ending_before') ending_before?: string,
    @Query('customer') customer?: string,
  ) {
    const userId = this.getUserId(req);
    return this.stripeService.listTransactions(userId, {
      limit: limit ? parseInt(limit) : undefined,
      starting_after,
      ending_before,
      customer,
    });
  }

  @Get('transactions/:id')
  @UseGuards(AuthGuard('jwt'))
  async getTransaction(@Request() req: any, @Param('id') id: string) {
    try {
      const userId = this.getUserId(req);
      return await this.stripeService.getTransaction(userId, id);
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch transaction',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('transactions-with-summary')
  @UseGuards(AuthGuard('jwt'))
  listTransactionsWithSummary(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('starting_after') starting_after?: string,
    @Query('ending_before') ending_before?: string,
    @Query('customer') customer?: string,
  ) {
    const userId = this.getUserId(req);
    return this.stripeService.listTransactionsWithSummary(userId, {
      limit: limit ? parseInt(limit) : undefined,
      starting_after,
      ending_before,
      customer,
    });
  }

  @Get('all-transactions')
  @UseGuards(AuthGuard('jwt'))
  getAllTransactions(@Request() req: any) {
    const userId = this.getUserId(req);
    return this.stripeService.getAllTransactionsWithSummary(userId);
  }

  @Get('accounts')
  @UseGuards(AuthGuard('jwt'))
  getAccounts(@Request() req: any) {
    const userId = this.getUserId(req);
    return this.stripeService.getConnectedAccounts(userId);
  }

  @Get('payouts')
  @UseGuards(AuthGuard('jwt'))
  listPayouts(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('starting_after') starting_after?: string,
    @Query('ending_before') ending_before?: string,
  ) {
    const userId = this.getUserId(req);
    return this.stripeService.listPayouts(userId, {
      limit: limit ? parseInt(limit) : undefined,
      starting_after,
      ending_before,
    });
  }

  @Get('payouts/:id')
  @UseGuards(AuthGuard('jwt'))
  getPayout(@Request() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    return this.stripeService.getPayout(userId, id);
  }

  @Get('all-payouts')
  @UseGuards(AuthGuard('jwt'))
  getAllPayouts(@Request() req: any) {
    const userId = this.getUserId(req);
    return this.stripeService.getAllPayoutsWithSummary(userId);
  }

  // NEW OPTIMIZED ENDPOINTS FOR FAST LOADING
  
  @Get('transactions-fast')
  @UseGuards(AuthGuard('jwt'))
  getTransactionsFast(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('account') account?: string,
  ) {
    const userId = this.getUserId(req);
    return this.stripeService.getTransactionsFast(userId, {
      limit: limit ? parseInt(limit) : undefined,
      page: page ? parseInt(page) : undefined,
      account,
    });
  }

  @Get('all-transactions-fast')
  @UseGuards(AuthGuard('jwt'))
  getAllTransactionsFast(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('status') status?: string,
    @Query('statusFilter') statusFilter?: string,
    @Query('days') days?: string,
    @Query('amount') amount?: string,
    @Query('amountOperator') amountOperator?: string,
    @Query('currency') currency?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    const userId = this.getUserId(req);
    // Parse statusFilter if provided (comma-separated string)
    const statusFilterArray = statusFilter
      ? statusFilter.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
      : undefined;

    return this.stripeService.getAllTransactionsFast(userId, {
      limit: limit ? parseInt(limit) : undefined,
      page: page ? parseInt(page) : undefined,
      status: status,
      statusFilter: statusFilterArray,
      days: days ? parseInt(days) : undefined,
      amount: amount ? parseFloat(amount) : undefined,
      amountOperator: amountOperator,
      currency: currency,
      paymentMethod: paymentMethod,
    });
  }

  @Get('all-payouts-fast')
  @UseGuards(AuthGuard('jwt'))
  getAllPayoutsFast(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('status') status?: string,
  ) {
    const userId = this.getUserId(req);
    return this.stripeService.getAllPayoutsFast(userId, {
      limit: limit ? parseInt(limit) : undefined,
      page: page ? parseInt(page) : undefined,
      status: status,
    });
  }

  @Get('payouts-fast')
  @UseGuards(AuthGuard('jwt'))
  getPayoutsFast(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('account') account?: string,
  ) {
    const userId = this.getUserId(req);
    return this.stripeService.getPayoutsFast(userId, {
      limit: limit ? parseInt(limit) : undefined,
      page: page ? parseInt(page) : undefined,
      account,
    });
  }

  @Get('summary-fast')
  @UseGuards(AuthGuard('jwt'))
  getSummaryFast(@Request() req: any, @Query('account') account?: string) {
    const userId = this.getUserId(req);
    return this.stripeService.getSummaryFast(userId, account);
  }

  @Get('accounts-fast')
  @UseGuards(AuthGuard('jwt'))
  getAccountsFast(@Request() req: any) {
    const userId = this.getUserId(req);
    return this.stripeService.getAccountsFast(userId);
  }

  @Get('all-customers-fast')
  @UseGuards(AuthGuard('jwt'))
  getAllCustomersFast(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const userId = this.getUserId(req);
    return this.stripeService.getAllCustomersFast(userId, {
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
  @UseGuards(AuthGuard('jwt'))
  getVolumeData(
    @Request() req: any,
    @Query('days') days?: string,
    @Query('groupBy') groupBy?: 'hour' | 'day',
    @Query('date') date?: string,
  ) {
    const userId = this.getUserId(req);
    return this.stripeService.getVolumeData(userId, {
      days: days ? parseInt(days) : undefined,
      groupBy,
      date: date ? new Date(date) : undefined,
    });
  }

  // Stripe Keys Management Endpoints
  @Post('keys')
  @UseGuards(AuthGuard('jwt'))
  async storeKeys(@Request() req: any, @Body() body: { secret_key: string; publishable_key: string }) {
    try {
      const userId = req.user.id;
      return await this.stripeKeysService.storeKeys(userId, body.secret_key, body.publishable_key);
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to save Stripe keys',
          message: error.message || 'Failed to save Stripe keys',
        },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('keys/status')
  @UseGuards(AuthGuard('jwt'))
  async checkKeysStatus(@Request() req: any) {
    try {
      const userId = req.user.id;
      return await this.stripeKeysService.checkKeysStatus(userId);
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to check keys status',
          message: error.message || 'Failed to check keys status',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('keys')
  @UseGuards(AuthGuard('jwt'))
  async getKeys(@Request() req: any) {
    try {
      const userId = req.user.id;
      return await this.stripeKeysService.getKeys(userId);
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to retrieve Stripe keys',
          message: error.message || 'Failed to retrieve Stripe keys',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('keys')
  @UseGuards(AuthGuard('jwt'))
  async deleteKeys(@Request() req: any) {
    try {
      const userId = req.user.id;
      return await this.stripeKeysService.deleteKeys(userId);
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to clear Stripe keys',
          message: error.message || 'Failed to clear Stripe keys',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}


