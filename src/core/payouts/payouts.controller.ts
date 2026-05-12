import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { PayoutsService } from './payouts.service';
import {
  AccountLookupDto,
  InitiatePayoutDto,
  RequeryPayoutDto,
} from './dto/payout-requests.dto';
import {
  AccountLookupResponseDto,
  InitiatePayoutResponseDto,
  PayoutListResponseDto,
  RequeryPayoutResponseDto,
} from './dto/payout-responses.dto';

@ApiTags('payouts')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('payouts')
export class PayoutsController {
  constructor(private payoutsService: PayoutsService) {}

  @Post('account-lookup')
  @ApiOperation({ summary: 'Lookup bank account name before payout' })
  @ApiResponse({ status: 200, type: AccountLookupResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  lookup(@Body() dto: AccountLookupDto) {
    return this.payoutsService.lookupAccount(dto);
  }

  @Post('transfer')
  @ApiOperation({
    summary: 'Initiate a bank payout',
    description:
      'Debits the caller\'s internal ledger balance and calls Squad /payout/transfer. ' +
      'The ledger debit and payout record are written atomically in a DB transaction before ' +
      'the Squad API is called. If Squad fails or returns a terminal status the debit is reversed.',
  })
  @ApiResponse({ status: 201, type: InitiatePayoutResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error, negative amount, or insufficient internal ledger balance' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  initiate(@CurrentUser() user: JwtPayload, @Body() dto: InitiatePayoutDto) {
    return this.payoutsService.initiatePayout(user, dto);
  }

  @Post('requery')
  @ApiOperation({ summary: 'Requery payout status by reference' })
  @ApiResponse({ status: 200, type: RequeryPayoutResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payout not found' })
  requery(@CurrentUser() user: JwtPayload, @Body() dto: RequeryPayoutDto) {
    return this.payoutsService.requeryPayout(user, dto);
  }

  @Get('list')
  @ApiOperation({ summary: 'List payouts for the authenticated user' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'perPage', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'dir', required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, type: PayoutListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('dir') dir?: 'ASC' | 'DESC',
  ) {
    const parsedPage = page ? Number(page) : undefined;
    const parsedPerPage = perPage ? Number(perPage) : undefined;
    const safeDir = dir === 'ASC' || dir === 'DESC' ? dir : 'DESC';
    return this.payoutsService.listPayouts(
      user,
      parsedPage,
      parsedPerPage,
      safeDir,
    );
  }
}
