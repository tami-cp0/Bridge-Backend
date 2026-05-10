import {
  Controller,
  Post,
  Param,
  Req,
  Headers,
  UseGuards,
  UnauthorizedException,
  HttpCode,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { SweepService } from './sweep.service';
import { SquadService } from '../squad/squad.service';
import { ReceivedResponseDto } from '../../common/dto/common-responses.dto';
import { BusinessGuard } from '../../common/guards/business.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('webhooks')
@Controller('webhooks')
export class SweepController {
  private readonly logger = new Logger(SweepController.name);

  constructor(
    private sweepService: SweepService,
    private squadService: SquadService,
  ) {}

  @Post('repay-full/:listingId')
  @UseGuards(BusinessGuard)
  @ApiBearerAuth('JWT')
  @ApiParam({
    name: 'listingId',
    description: 'UUID of the funded listing to repay in full',
  })
  @ApiOperation({
    summary:
      'Pay off the entire remaining balance on a listing in one transfer â€” releases any locked tranches first, then distributes to investors and closes the deal',
  })
  @ApiResponse({
    status: 201,
    schema: {
      type: 'object',
      properties: {
        repaid: {
          type: 'number',
          example: 3225000,
          description: 'Amount repaid in kobo',
        },
        message: {
          type: 'string',
          example: 'â‚¦32,250 repaid. Your listing is now completed.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Listing is not in funded status, or no remaining balance',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden â€” caller is not a business account',
  })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  @ApiResponse({ status: 502, description: 'Squad transfer failed' })
  repayFull(
    @Param('listingId') listingId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.sweepService.repayFull(listingId, user.userId);
  }

  @Post('squad')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Squad payment webhook â€” processes incoming virtual account payments and triggers revenue sweep',
  })
  @ApiHeader({
    name: 'x-squad-encrypted-body',
    description:
      'HMAC-SHA512 signature of the raw request body, signed with your Squad secret key',
    required: false,
  })
  @ApiBody({
    description:
      'Squad webhook payload. For virtual account payments: contains virtual_account_number, principal_amount, transaction_reference, channel="virtual-account". Signature verification is skipped in sandbox if the header is absent.',
    schema: {
      type: 'object',
      properties: {
        Event: { type: 'string', example: 'charge_successful' },
        virtual_account_number: { type: 'string', example: '1234567890' },
        principal_amount: { type: 'number', example: 500000 },
        transaction_reference: { type: 'string', example: 'REF20240101123456' },
        channel: { type: 'string', example: 'virtual-account' },
      },
    },
  })
  @ApiResponse({ status: 200, type: ReceivedResponseDto })
  @ApiResponse({
    status: 401,
    description:
      'Invalid webhook signature â€” x-squad-encrypted-body header present but HMAC verification failed',
  })
  async handleSquadWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-squad-encrypted-body') signature: string,
  ) {
    const rawBody = req.rawBody?.toString() ?? JSON.stringify(req.body);

    if (signature) {
      const valid = this.squadService.verifyWebhookSignature(
        rawBody,
        signature,
      );
      if (!valid) {
        this.logger.warn('Invalid Squad webhook signature');
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    const payload = req.body as Record<string, unknown>;
    await this.sweepService.handleSquadWebhook(payload);
    return { received: true };
  }
}
