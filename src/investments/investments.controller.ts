import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { InvestmentsService } from './investments.service';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { InvestorGuard } from '../common/guards/investor.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('investments')
@Controller()
export class InvestmentsController {
  constructor(private investmentsService: InvestmentsService) {}

  @Post('investments')
  @UseGuards(InvestorGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Commit capital to a listing' })
  @ApiResponse({ status: 201, description: 'Investment created. Triggers Squad transfer from investor to escrow. If listing is now fully funded, releases tranche 1 to the business.' })
  @ApiResponse({ status: 400, description: 'Below minimum investment, amount exceeds remaining, or listing not active' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Get all sweep events for a deal, with per-investor distribution if the caller is an investor in that deal' })
  @ApiResponse({ status: 200, description: 'Array of sweep events. If the caller invested in this listing, each event includes a distribution object with their share.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getSweeps(
    @Param('listingId') listingId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.investmentsService.getSweepsForDeal(listingId, user.userId);
  }
}
