import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { BridgeRatingService } from './bridge-rating.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BridgeRatingResponseDto } from './dto/bridge-rating-response.dto';

@ApiTags('business')
@ApiBearerAuth('JWT')
@Controller('business')
export class BridgeRatingController {
  constructor(private ratingService: BridgeRatingService) {}

  @Get(':businessId/rating')
  @UseGuards(JwtAuthGuard)
  @ApiParam({
    name: 'businessId',
    description: 'Business profile UUID (not the user UUID)',
  })
  @ApiOperation({ summary: 'Get Bridge Rating breakdown for a business' })
  @ApiResponse({ status: 200, type: BridgeRatingResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getRating(@Param('businessId') businessId: string) {
    return this.ratingService.getRating(businessId);
  }

  @Get(':businessId/rating/investor')
  @ApiParam({
    name: 'businessId',
    description: 'Business profile UUID (not the user UUID)',
  })
  @ApiOperation({
    summary:
      'Get investor-facing rating view — tier, standing, and positive signals only',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        tier: { type: 'number', example: 1 },
        standing: {
          type: 'string',
          enum: ['Seed', 'Established', 'Elite'],
          example: 'Established',
        },
        signals: {
          type: 'array',
          items: { type: 'string' },
          example: ['CAC verified', 'Fast repayments', 'Consistent payments'],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Business not found' })
  getInvestorView(@Param('businessId') businessId: string) {
    return this.ratingService.getInvestorView(businessId);
  }
}
