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
import { BusinessGuard } from '../../common/guards/business.guard';
import { InvestorGuard } from '../../common/guards/investor.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import {
  ListingResponseDto,
  CalculateTermsResponseDto,
} from './dto/listing-responses.dto';
import { SectorEnum } from '../../common/enums/sector.enum';

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private listingsService: ListingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Browse all active listings with optional filters and sorting',
  })
  @ApiQuery({ name: 'sector', required: false, enum: SectorEnum })
  @ApiQuery({ name: 'tier', required: false, type: Number, example: 1 })
  @ApiQuery({
    name: 'standing',
    required: false,
    enum: ['Seed', 'Established', 'Elite'],
  })
  @ApiQuery({
    name: 'minReturn',
    required: false,
    type: Number,
    description: 'Minimum total return percent',
    example: 15,
  })
  @ApiQuery({
    name: 'maxReturn',
    required: false,
    type: Number,
    description: 'Maximum total return percent',
    example: 30,
  })
  @ApiQuery({
    name: 'minCapital',
    required: false,
    type: Number,
    description: 'Minimum capital requested in kobo',
    example: 1000000,
  })
  @ApiQuery({
    name: 'maxCapital',
    required: false,
    type: Number,
    description: 'Maximum capital requested in kobo',
    example: 50000000,
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: [
      'highest_return',
      'fastest_repayment',
      'newest',
      'highest_bridge_rating',
    ],
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number, default 1',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Results per page, default 20',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/ListingResponseDto' },
        },
        total: { type: 'number', example: 42 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
      },
    },
  })
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
  @ApiOperation({
    summary: "Get AI-matched listings ranked by the investor's preferences",
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        listings: {
          type: 'array',
          items: {
            allOf: [
              { $ref: '#/components/schemas/ListingResponseDto' },
              {
                type: 'object',
                properties: { matchScore: { type: 'number', example: 87.5 } },
              },
            ],
          },
        },
        preferencesSet: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized â€” missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden â€” caller is not an investor account',
  })
  getMatchedListings(@CurrentUser() user: JwtPayload) {
    return this.listingsService.getMatchedListings(user.userId);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Listing UUID' })
  @ApiOperation({
    summary:
      'Get a single listing with full details, tranches, and Bridge Rating',
  })
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: '#/components/schemas/ListingResponseDto' },
        {
          type: 'object',
          properties: {
            tranches: {
              type: 'array',
              items: { $ref: '#/components/schemas/TrancheResponseDto' },
            },
            business_profiles: {
              $ref: '#/components/schemas/BusinessProfileDto',
            },
            bridge_ratings: {
              $ref: '#/components/schemas/BridgeRatingResponseDto',
            },
          },
        },
      ],
    },
  })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  getListingById(@Param('id') id: string) {
    return this.listingsService.getListingById(id);
  }

  @Post('calculate-terms')
  @UseGuards(BusinessGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Preview deal terms before creating a listing' })
  @ApiResponse({ status: 201, type: CalculateTermsResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Validation error, or capital requested exceeds tier limit',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized â€” missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden â€” caller is not a business account',
  })
  calculateTerms(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CalculateTermsDto,
  ) {
    return this.listingsService.calculateTerms(
      user.userId,
      dto.capitalRequested,
      dto.preferredRepaymentMonths,
    );
  }

  @Post()
  @UseGuards(BusinessGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary:
      'Create a new listing â€” generates AI profile and creates tranches',
  })
  @ApiResponse({ status: 201, type: ListingResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Validation error, or capital requested exceeds tier limit',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized â€” missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden â€” caller is not a business account',
  })
  @ApiResponse({
    status: 409,
    description: 'Business already has an active or funded listing',
  })
  createListing(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateListingDto,
  ) {
    return this.listingsService.createListing(user.userId, dto);
  }
}
