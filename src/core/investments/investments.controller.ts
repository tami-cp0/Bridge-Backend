import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { InvestmentsService } from './investments.service';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InvestorGuard } from '../../common/guards/investor.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { InvestmentResponseDto } from '../investor/dto/investor-responses.dto';
import { SweepEventWithDistributionDto } from './dto/investment-responses.dto';

@ApiTags('investments')
@Controller()
export class InvestmentsController {
  constructor(private investmentsService: InvestmentsService) {}

  @Post('investments')
  @UseGuards(InvestorGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Commit capital to a listing' })
  @ApiResponse({ status: 201, type: InvestmentResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error, below minimum investment (â‚¦5,000), amount exceeds remaining unfunded amount, listing not active, or investor virtual account not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized â€” missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Forbidden â€” caller is not an investor account' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  @ApiResponse({ status: 502, description: 'Squad transfer failed' })
  createInvestment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateInvestmentDto,
  ) {
    return this.investmentsService.createInvestment(user.userId, dto);
  }

  @Get('deals/:listingId/sweeps')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiParam({ name: 'listingId', description: 'Listing UUID' })
  @ApiOperation({ summary: 'Get all sweep events for a deal. If the caller invested in this listing, each event includes their distribution amount.' })
  @ApiResponse({ status: 200, type: SweepEventWithDistributionDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Unauthorized â€” missing or invalid token' })
  getSweeps(
    @Param('listingId') listingId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.investmentsService.getSweepsForDeal(listingId, user.userId);
  }
}
