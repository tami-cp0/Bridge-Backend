import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { SweepService } from '../sweep/sweep.service';
import { LedgerService } from '../ledger/ledger.service';
import { ConnectBankDto } from './dto/connect-bank.dto';
import { BusinessGuard } from '../../common/guards/business.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  BusinessProfileFullResponseDto,
  BusinessStatsResponseDto,
  PaymentLinkResponseDto,
  SweepSummaryResponseDto,
} from './dto/business-responses.dto';
import { ListingResponseDto } from '../listings/dto/listing-responses.dto';
import { NotificationResponseDto } from '../notifications/dto/notification-response.dto';
import { SweepEventResponseDto } from '../listings/dto/listing-responses.dto';

@ApiTags('business')
@ApiBearerAuth('JWT')
@Controller('business')
export class BusinessController {
  constructor(
    private businessService: BusinessService,
    private sweepService: SweepService,
    private ledgerService: LedgerService,
  ) {}

  @Post('connect-bank')
  @UseGuards(BusinessGuard)
  @ApiOperation({
    summary:
      'Connect business bank account via Mono — exchanges Mono Connect code and triggers async income analysis. Income is delivered via the mono.events.account_income webhook.',
  })
  @ApiResponse({
    status: 201,
    schema: {
      type: 'object',
      properties: {
        connected: { type: 'boolean', example: true },
        averageMonthlyInflow: {
          nullable: true,
          example: null,
          description:
            'Always null on connect — populated on the business profile once Mono delivers the mono.events.account_income webhook',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired Mono Connect code',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — caller is not a business account',
  })
  @ApiResponse({ status: 404, description: 'Business profile not found' })
  @ApiResponse({ status: 409, description: 'Bank account already connected' })
  connectBank(@CurrentUser() user: JwtPayload, @Body() dto: ConnectBankDto) {
    return this.businessService.connectBank(user.userId, dto.code);
  }

  @Get(':userId/profile')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({
    summary:
      'Get full business profile joined with user details and Bridge Rating',
  })
  @ApiResponse({ status: 200, type: BusinessProfileFullResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized â€” missing or invalid token',
  })
  @ApiResponse({ status: 404, description: 'Business profile not found' })
  getProfile(@Param('userId') userId: string) {
    return this.businessService.getProfile(userId);
  }

  @Post(':userId/simulate-revenue')
  @UseGuards(BusinessGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({
    summary: 'Simulate revenue by depositing 5% of monthly revenue every 10s for 1 minute',
  })
  @ApiResponse({ status: 201, description: 'Simulation started' })
  @ApiResponse({ status: 400, description: 'No revenue to simulate from' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Profile or virtual account not found' })
  simulateRevenue(
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (userId !== user.userId) {
      throw new BadRequestException('You can only simulate revenue for your own business');
    }
    return this.businessService.simulateRevenue(userId);
  }

  @Get(':userId/stats')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({
    summary: 'Get quick stats across all completed and funded deals',
  })
  @ApiResponse({ status: 200, type: BusinessStatsResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized â€” missing or invalid token',
  })
  @ApiResponse({ status: 404, description: 'Business profile not found' })
  getStats(@Param('userId') userId: string) {
    return this.businessService.getStats(userId);
  }

  @Get(':userId/balance')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get the internal ledger balance for the business wallet' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        balance: { type: 'number', example: 150000, description: 'Available balance in kobo' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBalance(@Param('userId') userId: string) {
    const balance = await this.ledgerService.getAvailableBalance(userId);
    return { balance };
  }

  @Get(':userId/active-listing')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({
    summary: 'Get the current active or funded listing for the business',
  })
  @ApiResponse({
    status: 200,
    type: ListingResponseDto,
    description: 'Active listing object, or null if none exists',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized â€” missing or invalid token',
  })
  @ApiResponse({ status: 404, description: 'Business profile not found' })
  getActiveListing(@Param('userId') userId: string) {
    return this.businessService.getActiveListing(userId);
  }

  @Get(':userId/activity')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get last 5 activity events for the business' })
  @ApiResponse({ status: 200, type: NotificationResponseDto, isArray: true })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized â€” missing or invalid token',
  })
  getActivity(@Param('userId') userId: string) {
    return this.businessService.getActivity(userId);
  }

  @Get(':userId/payment-link')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({
    summary:
      'Get the Squad payment link and virtual account number for QR generation',
  })
  @ApiResponse({ status: 200, type: PaymentLinkResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized â€” missing or invalid token',
  })
  @ApiResponse({
    status: 404,
    description: 'Virtual account not found â€” BVN not yet verified',
  })
  getPaymentLink(@Param('userId') userId: string) {
    return this.businessService.getPaymentLink(userId);
  }

  @Get(':userId/payments')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({
    summary:
      'Get last 10 incoming payments with sweep breakdown for the active listing',
  })
  @ApiResponse({ status: 200, type: SweepEventResponseDto, isArray: true })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized â€” missing or invalid token',
  })
  getPayments(@Param('userId') userId: string) {
    return this.businessService.getPayments(userId);
  }

  @Get(':userId/revenue')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiQuery({
    name: 'period',
    required: true,
    enum: ['hourly', 'daily', 'monthly', 'yearly'],
    description: 'Aggregation period',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Required for hourly, daily and monthly periods',
    example: 2025,
  })
  @ApiQuery({
    name: 'month',
    required: false,
    type: Number,
    description: 'Required for hourly and daily periods (1-12)',
    example: 5,
  })
  @ApiQuery({
    name: 'day',
    required: false,
    type: Number,
    description: 'Required for hourly period (1-31)',
    example: 10,
  })
  @ApiOperation({
    summary:
      'Get incoming revenue aggregated by day, month, or year â€” excludes manual full-repayment events',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['hourly', 'daily', 'monthly', 'yearly'] },
        year: { type: 'number', example: 2025 },
        month: { type: 'number', example: 5 },
        day: { type: 'number', example: 10 },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', example: '2025-05-10' },
              totalIncoming: {
                type: 'number',
                example: 1500000,
                description: 'Total incoming payments in kobo',
              },
              totalSwept: {
                type: 'number',
                example: 127500,
                description: 'Amount swept to investors in kobo',
              },
              totalRetained: {
                type: 'number',
                example: 1372500,
                description: 'Amount retained by the business in kobo',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'year/month required for the selected period',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getRevenue(
    @Param('userId') userId: string,
    @Query('period') period: 'hourly' | 'daily' | 'monthly' | 'yearly',
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('day') day?: string,
  ) {
    return this.businessService.getRevenue(
      userId,
      period,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
      day ? Number(day) : undefined,
    );
  }

  @Get(':userId/sweep-summary')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get sweep summary for the active deal' })
  @ApiResponse({ status: 200, type: SweepSummaryResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized â€” missing or invalid token',
  })
  @ApiResponse({ status: 404, description: 'Business profile not found' })
  getSweepSummary(@Param('userId') userId: string) {
    return this.businessService.getSweepSummary(userId);
  }

  @Post('repay/:listingId')
  @UseGuards(BusinessGuard)
  @ApiParam({ name: 'listingId', description: 'UUID of the funded listing to repay in full' })
  @ApiOperation({
    summary:
      'Pay off the entire remaining balance on a listing in one transfer — releases any locked tranches first, then distributes to investors and closes the deal',
  })
  @ApiResponse({
    status: 201,
    schema: {
      type: 'object',
      properties: {
        repaid: { type: 'number', example: 3225000, description: 'Amount repaid in kobo' },
        message: { type: 'string', example: '₦32,250 repaid. Your listing is now completed.' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Listing is not in funded status, or no remaining balance' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — caller is not a business account' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  @ApiResponse({ status: 502, description: 'Squad transfer failed' })
  repayFull(
    @Param('listingId') listingId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sweepService.repayFull(listingId, user.userId);
  }
}
