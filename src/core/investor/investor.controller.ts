import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { InvestorService } from './investor.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { SimulateDepositDto } from './dto/deposit.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InvestorGuard } from '../../common/guards/investor.guard';
import {
  InvestorSummaryResponseDto,
  WalletResponseDto,
  InvestmentResponseDto,
  InvestorProfileDto,
  InvestorProfileFullResponseDto,
} from './dto/investor-responses.dto';
import { PaymentLinkResponseDto } from '../business/dto/business-responses.dto';
import { NotificationResponseDto } from '../notifications/dto/notification-response.dto';

@ApiTags('investor')
@ApiBearerAuth('JWT')
@Controller('investor')
export class InvestorController {
  constructor(private investorService: InvestorService) {}

  @Get(':userId/profile')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Investor user UUID' })
  @ApiOperation({ summary: 'Get full investor profile joined with user details' })
  @ApiResponse({ status: 200, type: InvestorProfileFullResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Investor profile not found' })
  getProfile(@Param('userId') userId: string) {
    return this.investorService.getProfile(userId);
  }

  @Get(':userId/payment-link')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Investor user UUID' })
  @ApiOperation({
    summary: 'Get the Squad payment link and virtual account number for wallet top-up',
  })
  @ApiResponse({ status: 200, type: PaymentLinkResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Virtual account not found' })
  getPaymentLink(@Param('userId') userId: string) {
    return this.investorService.getPaymentLink(userId);
  }

  @Get(':userId/summary')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Investor user UUID' })
  @ApiOperation({ summary: 'Get investor dashboard summary numbers' })
  @ApiResponse({ status: 200, type: InvestorSummaryResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized â€” missing or invalid token',
  })
  getSummary(@Param('userId') userId: string) {
    return this.investorService.getSummary(userId);
  }

  @Get(':userId/activity')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Investor user UUID' })
  @ApiOperation({
    summary: 'Get last 5 platform activity events for the investor',
  })
  @ApiResponse({ status: 200, type: NotificationResponseDto, isArray: true })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized â€” missing or invalid token',
  })
  getActivity(@Param('userId') userId: string) {
    return this.investorService.getActivity(userId);
  }

  @Get(':userId/deals')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Investor user UUID' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'completed', 'defaulted'],
    description: 'Filter by deal status. Omit to return all deals.',
  })
  @ApiOperation({
    summary: 'Get investor deals, optionally filtered by status',
  })
  @ApiResponse({ status: 200, type: InvestmentResponseDto, isArray: true })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized â€” missing or invalid token',
  })
  getDeals(@Param('userId') userId: string, @Query('status') status?: string) {
    return this.investorService.getDeals(userId, status);
  }

  @Get(':userId/wallet')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Investor user UUID' })
  @ApiOperation({
    summary: 'Get Squad wallet balance and default pool balance',
  })
  @ApiResponse({ status: 200, type: WalletResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized â€” missing or invalid token',
  })
  @ApiResponse({
    status: 404,
    description: 'Virtual account not found â€” BVN not yet verified',
  })
  getWallet(@Param('userId') userId: string) {
    return this.investorService.getWallet(userId);
  }

  @Post(':userId/deposit')
  @UseGuards(InvestorGuard)
  @ApiParam({ name: 'userId', description: 'Investor user UUID' })
  @ApiOperation({
    summary:
      'Sandbox: simulate an incoming deposit to the investor Squad virtual account',
  })
  @ApiResponse({
    status: 201,
    schema: {
      type: 'object',
      properties: {
        simulated: { type: 'boolean', example: true },
        amount: { type: 'number', example: 500000, description: 'Amount in kobo' },
        virtualAccountNumber: { type: 'string', example: '9912345678' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — caller is not an investor account' })
  @ApiResponse({ status: 404, description: 'Virtual account not found' })
  simulateDeposit(
    @Param('userId') userId: string,
    @Body() dto: SimulateDepositDto,
  ) {
    return this.investorService.simulateDeposit(userId, dto.amount);
  }

  @Patch(':userId/preferences')
  @UseGuards(InvestorGuard)
  @ApiParam({ name: 'userId', description: 'Investor user UUID' })
  @ApiOperation({
    summary: 'Update investor matching preferences â€” all fields optional',
  })
  @ApiResponse({ status: 200, type: InvestorProfileDto })
  @ApiResponse({
    status: 400,
    description: 'Validation error â€” invalid field values',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized â€” missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden â€” caller is not an investor account',
  })
  updatePreferences(
    @Param('userId') userId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.investorService.updatePreferences(userId, dto);
  }

  @Get(':userId/returns')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Investor user UUID' })
  @ApiQuery({
    name: 'period',
    required: true,
    enum: ['daily', 'monthly', 'yearly'],
    description: 'Time bucket granularity',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: Number,
    description: 'Required for daily and monthly periods',
  })
  @ApiQuery({
    name: 'month',
    required: false,
    type: Number,
    description: 'Required for daily period (1–12)',
  })
  @ApiOperation({
    summary:
      'Get investor returns over time — time-series of sweep distributions received',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['daily', 'monthly', 'yearly'],
          example: 'monthly',
        },
        year: { type: 'number', example: 2025, nullable: true },
        month: { type: 'number', example: null, nullable: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', example: '2025-03' },
              totalReturnsReceived: {
                type: 'number',
                example: 45000,
                description: 'Returns received in this period, in kobo',
              },
              cumulativeReturns: {
                type: 'number',
                example: 320000,
                description: 'Running total of all returns up to this period, in kobo',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Missing year or month for the chosen period' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  getReturns(
    @Param('userId') userId: string,
    @Query('period') period: 'daily' | 'monthly' | 'yearly',
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.investorService.getReturns(
      userId,
      period,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }
}
