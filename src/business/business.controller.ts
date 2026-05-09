import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('business')
@ApiBearerAuth('JWT')
@Controller('business')
export class BusinessController {
  constructor(private businessService: BusinessService) {}

  @Get(':userId/profile')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get full business profile joined with user details and Bridge Rating' })
  @ApiResponse({ status: 200, description: 'Business profile, user record, and Bridge Rating joined' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Business profile not found' })
  getProfile(@Param('userId') userId: string) {
    return this.businessService.getProfile(userId);
  }

  @Get(':userId/stats')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get quick stats across all completed and funded deals' })
  @ApiResponse({ status: 200, description: '{ totalCapitalRaised, totalSweptToInvestors (kobo), completedDealsCount }' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Business profile not found' })
  getStats(@Param('userId') userId: string) {
    return this.businessService.getStats(userId);
  }

  @Get(':userId/active-listing')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get the current active or funded listing for the business' })
  @ApiResponse({ status: 200, description: 'Active listing object, or null if no active or funded listing exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Business profile not found' })
  getActiveListing(@Param('userId') userId: string) {
    return this.businessService.getActiveListing(userId);
  }

  @Get(':userId/activity')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get last 5 activity events for the business' })
  @ApiResponse({ status: 200, description: 'Array of up to 5 recent notification objects' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  getActivity(@Param('userId') userId: string) {
    return this.businessService.getActivity(userId);
  }

  @Get(':userId/payment-link')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get the Squad payment link and virtual account number for QR generation' })
  @ApiResponse({ status: 200, description: '{ paymentLink: string, virtualAccountNumber: string }' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Virtual account not found — BVN not yet verified' })
  getPaymentLink(@Param('userId') userId: string) {
    return this.businessService.getPaymentLink(userId);
  }

  @Get(':userId/payments')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get last 10 incoming payments with sweep breakdown for the active listing' })
  @ApiResponse({ status: 200, description: 'Array of sweep event records: incomingPaymentAmount, sweepAmount, netAmountRetained, processedAt (kobo)' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  getPayments(@Param('userId') userId: string) {
    return this.businessService.getPayments(userId);
  }

  @Get(':userId/sweep-summary')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'userId', description: 'Business user UUID' })
  @ApiOperation({ summary: 'Get sweep summary for the active deal' })
  @ApiResponse({ status: 200, description: '{ totalSwept, totalRemaining (kobo), currentSweepPercent }' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid token' })
  @ApiResponse({ status: 404, description: 'Business profile not found' })
  getSweepSummary(@Param('userId') userId: string) {
    return this.businessService.getSweepSummary(userId);
  }
}
