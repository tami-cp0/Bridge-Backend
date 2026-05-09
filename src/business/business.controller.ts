import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
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
