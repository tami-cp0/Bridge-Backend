import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { CalculateTermsDto } from './dto/calculate-terms.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { InvestorGuard } from '../common/guards/investor.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private listingsService: ListingsService) {}

  @Get()
  @ApiOperation({ summary: 'Browse all active listings with optional filters and sorting' })
  @ApiQuery({ name: 'sector', required: false, example: 'Food & Beverage' })
  @ApiQuery({ name: 'tier', required: false, example: 1 })
  @ApiQuery({ name: 'standing', required: false, enum: ['Seed', 'Rising', 'Established', 'Trusted', 'Elite'] })
  @ApiQuery({ name: 'minReturn', required: false, description: 'Minimum total return percent', example: 15 })
  @ApiQuery({ name: 'maxReturn', required: false, description: 'Maximum total return percent', example: 30 })
  @ApiQuery({ name: 'minCapital', required: false, description: 'Minimum capital requested in kobo', example: 1000000 })
  @ApiQuery({ name: 'maxCapital', required: false, description: 'Maximum capital requested in kobo', example: 50000000 })
  @ApiQuery({ name: 'sort', required: false, enum: ['highest_return', 'fastest_repayment', 'newest', 'highest_bridge_rating'] })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated list of active listings with business profiles and Bridge Ratings' })
  getListings(
    @Query('sector') sector?: string,
    @Query('tier') tier?: string,
    @Query('standing') standing?: string,
    @Query('minReturn') minReturn?: string,
    @Query('maxReturn') maxReturn?: string,
    @Query('minCapital') minCapital?: string,
    @Query('maxCapital') maxCapital?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.listingsService.getListings({
      sector,
      tier: tier ? Number(tier) : undefined,
      standing,
      minReturn: minReturn ? Number(minReturn) : undefined,
      maxReturn: maxReturn ? Number(maxReturn) : undefined,
      minCapital: minCapital ? Number(minCapital) : undefined,
      maxCapital: maxCapital ? Number(maxCapital) : undefined,
      sort,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('matched')
  @UseGuards(InvestorGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get AI-matched listings ranked by the investor\'s preferences' })
  @ApiResponse({ status: 200, description: 'Returns listings array with matchScore, and preferencesSet flag' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMatchedListings(@CurrentUser() user: JwtPayload) {
    return this.listingsService.getMatchedListings(user.userId);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  @ApiOperation({ summary: 'Get a single listing with full details, tranches, and Bridge Rating' })
  @ApiResponse({ status: 200, description: 'Full listing object including business profile, Bridge Rating, and tranches array' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  getListingById(@Param('id') id: string) {
    return this.listingsService.getListingById(id);
  }

  @Post('calculate-terms')
  @UseGuards(BusinessGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Preview deal terms before creating a listing' })
  @ApiResponse({ status: 201, description: 'Calculated terms: revenueSharePercent, totalReturnPercent, totalReturnAmount, targetRepaymentMonths, monthlySweepAtAverage, tranche breakdown, and returnRateBreakdown' })
  @ApiResponse({ status: 400, description: 'Capital exceeds tier limit' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  calculateTerms(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CalculateTermsDto,
  ) {
    return this.listingsService.calculateTerms(user.userId, dto.capitalRequested);
  }

  @Post()
  @UseGuards(BusinessGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create a new listing — generates AI profile and creates tranches' })
  @ApiResponse({ status: 201, description: 'Created listing object. Also triggers AI profile generation and tranche creation.' })
  @ApiResponse({ status: 400, description: 'Capital exceeds tier limit' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Business already has an active or funded listing' })
  createListing(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateListingDto,
  ) {
    return this.listingsService.createListing(user.userId, dto);
  }
}
