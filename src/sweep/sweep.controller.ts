import {
  Controller,
  Post,
  Req,
  Headers,
  UnauthorizedException,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBody } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { SweepService } from './sweep.service';
import { SquadService } from '../squad/squad.service';
import { ReceivedResponseDto } from '../common/dto/common-responses.dto';

@ApiTags('webhooks')
@Controller('webhooks')
export class SweepController {
  private readonly logger = new Logger(SweepController.name);

  constructor(
    private sweepService: SweepService,
    private squadService: SquadService,
  ) {}

  @Post('squad')
  @HttpCode(200)
  @ApiOperation({ summary: 'Squad payment webhook — processes incoming virtual account payments and triggers revenue sweep' })
  @ApiHeader({ name: 'x-squad-encrypted-body', description: 'HMAC-SHA512 signature of the raw request body, signed with your Squad secret key', required: false })
  @ApiBody({
    description: 'Squad webhook payload. For virtual account payments: contains virtual_account_number, principal_amount, transaction_reference, channel="virtual-account". Signature verification is skipped in sandbox if the header is absent.',
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
  @ApiResponse({ status: 401, description: 'Invalid webhook signature — x-squad-encrypted-body header present but HMAC verification failed' })
  async handleSquadWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-squad-encrypted-body') signature: string,
  ) {
    const rawBody = req.rawBody?.toString() ?? JSON.stringify(req.body);

    if (signature) {
      const valid = this.squadService.verifyWebhookSignature(rawBody, signature);
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
