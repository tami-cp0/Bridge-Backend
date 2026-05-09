import {
  Controller,
  Post,
  Req,
  Headers,
  UnauthorizedException,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { SweepService } from './sweep.service';
import { SquadService } from '../squad/squad.service';

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
  @ApiOperation({ summary: 'Squad payment webhook — processes incoming payments and triggers revenue sweep' })
  @ApiHeader({ name: 'x-squad-encrypted-body', description: 'HMAC-SHA512 signature for payload verification', required: false })
  @ApiResponse({ status: 200, description: '{ received: true }. Triggers sweep: deducts revenue share, distributes to investors, updates Bridge Rating.' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
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
