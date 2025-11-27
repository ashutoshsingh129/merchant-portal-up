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
import { StripeDbService } from './stripe-db.service';
import { StripeSyncService } from './stripe-sync.service';

@Controller('stripe')
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly stripeKeysService: StripeKeysService,
    private readonly stripeDbService: StripeDbService,
    private readonly stripeSyncService: StripeSyncService,
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
      ? statusFilter
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
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

  // NEW DATABASE-PAGINATED ENDPOINTS
  @Get('transactions-db')
  @UseGuards(AuthGuard('jwt'))
  async getTransactionsFromDb(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const userId = this.getUserId(req);
      const pageNum = page ? parseInt(page) : 1;
      const limitNum = limit ? parseInt(limit) : 10;
      return await this.stripeDbService.getCombinedTransactions(
        userId,
        pageNum,
        limitNum,
      );
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch transactions',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('transactions-db/:id')
  @UseGuards(AuthGuard('jwt'))
  async getTransactionFromDb(@Request() req: any, @Param('id') id: string) {
    try {
      const userId = this.getUserId(req);
      const transaction = await this.stripeDbService.getTransactionById(
        userId,
        id,
      );
      if (!transaction) {
        throw new HttpException('Transaction not found', HttpStatus.NOT_FOUND);
      }
      return transaction;
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch transaction',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sync-initial')
  @UseGuards(AuthGuard('jwt'))
  async triggerInitialSync(@Request() req: any) {
    try {
      const userId = this.getUserId(req);
      const result = await this.stripeSyncService.syncInitialRecords(userId);
      return {
        message: 'Initial sync completed successfully',
        paymentIntents: result.paymentIntents,
        charges: result.charges,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to sync data',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sync-batch')
  @UseGuards(AuthGuard('jwt'))
  async triggerBatchSync(
    @Request() req: any,
    @Body() body?: { batchSize?: number },
  ) {
    try {
      const userId = this.getUserId(req);
      const batchSize = body?.batchSize || 100;
      const result = await this.stripeSyncService.syncNextBatch(
        userId,
        batchSize,
      );
      return {
        message: 'Batch sync completed successfully',
        paymentIntents: result.paymentIntents,
        charges: result.charges,
        hasMore:
          result.paymentIntents.hasMore || result.charges.hasMore,
      };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to sync batch',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sync-all')
  @UseGuards(AuthGuard('jwt'))
  async triggerFullSync(@Request() req: any) {
    try {
      const userId = this.getUserId(req);
      console.log(`🔄 Manual full sync triggered for user ${userId}`);

      // Get current status before sync
      const statusBefore = await this.stripeDbService.getSyncStatus(userId);
      console.log(
        `📊 Status before sync: ${statusBefore.paymentIntentsCount} PIs, ${statusBefore.chargesCount} Charges`,
      );

      const result = await this.stripeSyncService.syncAllRecordsForUser(userId);

      // Get status after sync
      const statusAfter = await this.stripeDbService.getSyncStatus(userId);
      console.log(
        `📊 Status after sync: ${statusAfter.paymentIntentsCount} PIs, ${statusAfter.chargesCount} Charges`,
      );

      return {
        message: 'Full sync completed successfully',
        statusBefore: {
          paymentIntents: statusBefore.paymentIntentsCount,
          charges: statusBefore.chargesCount,
        },
        statusAfter: {
          paymentIntents: statusAfter.paymentIntentsCount,
          charges: statusAfter.chargesCount,
        },
        paymentIntents: {
          synced: result.paymentIntents.synced,
          skipped: result.paymentIntents.skipped,
        },
        charges: {
          synced: result.charges.synced,
          skipped: result.charges.skipped,
        },
      };
    } catch (error: any) {
      console.error('❌ Full sync error:', error);
      throw new HttpException(
        error.message || 'Failed to sync all data',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sync-status')
  @UseGuards(AuthGuard('jwt'))
  async getSyncStatus(@Request() req: any) {
    try {
      const userId = this.getUserId(req);
      return await this.stripeDbService.getSyncStatus(userId);
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to get sync status',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Stripe Keys Management Endpoints
  @Post('keys')
  @UseGuards(AuthGuard('jwt'))
  async storeKeys(
    @Request() req: any,
    @Body() body: { secret_key: string; publishable_key: string },
  ) {
    try {
      const userId = req.user.id;
      const result = await this.stripeKeysService.storeKeys(
        userId,
        body.secret_key,
        body.publishable_key,
      );

      // Trigger FULL sync after keys are stored (fetches ALL records automatically)
      // Run this in the background so it doesn't block the response
      // But start it immediately
      (async () => {
        try {
          // Wait a moment for keys to be fully saved
          await new Promise((resolve) => setTimeout(resolve, 2000));

          console.log(
            `═══════════════════════════════════════════════════════════`,
          );
          console.log(
            `🔄 Starting AUTOMATIC FULL SYNC for user ${userId} after keys stored...`,
          );
          console.log(
            `   This will fetch ALL payment intents and charges from Stripe...`,
          );
          console.log(
            `═══════════════════════════════════════════════════════════`,
          );

          await this.stripeSyncService.syncForUser(userId, true);

          console.log(
            `═══════════════════════════════════════════════════════════`,
          );
          console.log(`✅ Automatic FULL sync completed for user ${userId}`);
          console.log(
            `═══════════════════════════════════════════════════════════`,
          );
        } catch (syncError: any) {
          console.error(
            `═══════════════════════════════════════════════════════════`,
          );
          console.error(
            `❌ ERROR during automatic sync after storing keys for user ${userId}`,
          );
          console.error(`   Message: ${syncError.message}`);
          console.error(`   Stack: ${syncError.stack}`);
          console.error(
            `═══════════════════════════════════════════════════════════`,
          );
          // Don't fail the request if sync fails, just log it
        }
      })();

      return result;
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
