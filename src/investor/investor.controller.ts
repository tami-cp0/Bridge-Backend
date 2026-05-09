import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { InvestorService } from './investor.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { InvestorGuard } from '../common/guards/investor.guard';
import {
  InvestorSummaryResponseDto,
  WalletResponseDto,
  InvestmentResponseDto,
  InvestorProfileDto,
} from './dto/investor-responses.dto';
import { NotificationResponseDto } from '../notifications/dto/notification-response.dto';

@ApiTags('investor')
@ApiBearerAuth('JWT')
@Controller('investor')
export class InvestorController {
  constructor(private investorService: InvestorService) {}

  @Get(':userId/summary')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Investor user UUID' })
  @ApiOperation({ summary: 'Get investor dashboard summary numbers' })
  @ApiResponse({ status: 200, type: InvestorSummaryResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  getSummary(@Param('userId') userId: string) {
    return this.investorService.getSummary(userId);
  }

  @Get(':userId/activity')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Investor user UUID' })
  @ApiOperation({ summary: 'Get last 5 platform activity events for the investor' })
  @ApiResponse({ status: 200, type: NotificationResponseDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  getActivity(@Param('userId') userId: string) {
    return this.investorService.getActivity(userId);
  }

  @Get(':userId/deals')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Investor user UUID' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'completed', 'defaulted'], description: 'Filter by deal status. Omit to return all deals.' })
  @ApiOperation({ summary: 'Get investor deals, optionally filtered by status' })
  @ApiResponse({ status: 200, type: InvestmentResponseDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  getDeals(@Param('userId') userId: string, @Query('status') status?: string) {
    return this.investorService.getDeals(userId, status);
  }

  @Get(':userId/wallet')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Investor user UUID' })
  @ApiOperation({ summary: 'Get Squad wallet balance and default pool balance' })
  @ApiResponse({ status: 200, type: WalletResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Virtual account not found — BVN not yet verified' })
  getWallet(@Param('userId') userId: string) {
    return this.investorService.getWallet(userId);
  }

  @Patch(':userId/preferences')
  @UseGuards(InvestorGuard)
  @ApiParam({ name: 'userId', description: 'Investor user UUID' })
  @ApiOperation({ summary: 'Update investor matching preferences — all fields optional' })
  @ApiResponse({ status: 200, type: InvestorProfileDto })
  @ApiResponse({ status: 400, description: 'Validation error — invalid field values' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Forbidden — caller is not an investor account' })
  updatePreferences(
    @Param('userId') userId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.investorService.updatePreferences(userId, dto);
  }
}
