import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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
  constructor(private businessService: BusinessService) {}

  @Get(':userId/profile')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get full business profile joined with user details and Bridge Rating' })
  @ApiResponse({ status: 200, type: BusinessProfileFullResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Business profile not found' })
  getProfile(@Param('userId') userId: string) {
    return this.businessService.getProfile(userId);
  }

  @Get(':userId/stats')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get quick stats across all completed and funded deals' })
  @ApiResponse({ status: 200, type: BusinessStatsResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Business profile not found' })
  getStats(@Param('userId') userId: string) {
    return this.businessService.getStats(userId);
  }

  @Get(':userId/active-listing')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get the current active or funded listing for the business' })
  @ApiResponse({ status: 200, type: ListingResponseDto, description: 'Active listing object, or null if none exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Business profile not found' })
  getActiveListing(@Param('userId') userId: string) {
    return this.businessService.getActiveListing(userId);
  }

  @Get(':userId/activity')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get last 5 activity events for the business' })
  @ApiResponse({ status: 200, type: NotificationResponseDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  getActivity(@Param('userId') userId: string) {
    return this.businessService.getActivity(userId);
  }

  @Get(':userId/payment-link')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get the Squad payment link and virtual account number for QR generation' })
  @ApiResponse({ status: 200, type: PaymentLinkResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Virtual account not found — BVN not yet verified' })
  getPaymentLink(@Param('userId') userId: string) {
    return this.businessService.getPaymentLink(userId);
  }

  @Get(':userId/payments')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get last 10 incoming payments with sweep breakdown for the active listing' })
  @ApiResponse({ status: 200, type: SweepEventResponseDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  getPayments(@Param('userId') userId: string) {
    return this.businessService.getPayments(userId);
  }

  @Get(':userId/revenue')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiQuery({ name: 'period', required: true, enum: ['daily', 'monthly', 'yearly'], description: 'Aggregation period' })
  @ApiQuery({ name: 'year', required: false, type: Number, description: 'Required for daily and monthly periods', example: 2025 })
  @ApiQuery({ name: 'month', required: false, type: Number, description: 'Required for daily period (1–12)', example: 5 })
  @ApiOperation({ summary: 'Get incoming revenue aggregated by day, month, or year — excludes manual full-repayment events' })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['daily', 'monthly', 'yearly'] },
        year: { type: 'number', example: 2025 },
        month: { type: 'number', example: 5 },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', example: '2025-05-10' },
              totalIncoming: { type: 'number', example: 1500000, description: 'Total incoming payments in kobo' },
              totalSwept: { type: 'number', example: 127500, description: 'Amount swept to investors in kobo' },
              totalRetained: { type: 'number', example: 1372500, description: 'Amount retained by the business in kobo' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'year/month required for the selected period' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getRevenue(
    @Param('userId') userId: string,
    @Query('period') period: 'daily' | 'monthly' | 'yearly',
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.businessService.getRevenue(
      userId,
      period,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }

  @Get(':userId/sweep-summary')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get sweep summary for the active deal' })
  @ApiResponse({ status: 200, type: SweepSummaryResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Business profile not found' })
  getSweepSummary(@Param('userId') userId: string) {
    return this.businessService.getSweepSummary(userId);
  }
}
