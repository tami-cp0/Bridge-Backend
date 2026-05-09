import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { BridgeRatingService } from './bridge-rating.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('business')
@ApiBearerAuth('JWT')
@Controller('business')
export class BridgeRatingController {
  constructor(private ratingService: BridgeRatingService) {}

  @Get(':businessId/rating')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'businessId', description: 'Business profile UUID (not the user UUID)' })
  @ApiOperation({ summary: 'Get Bridge Rating breakdown for a business' })
  @ApiResponse({ status: 200, description: 'overallScore, standing, and component scores: repaymentSpeedScore, repaymentConsistencyScore, transactionVolumeScore, revenueConsistencyScore, cacBonusScore, communicationScore' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getRating(@Param('businessId') businessId: string) {
    return this.ratingService.getRating(businessId);
  }
}
