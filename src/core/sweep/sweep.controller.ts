import {
  Controller,
  Post,
  Req,
  Headers,
  UnauthorizedException,
  HttpCode,
  Logger,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import { SweepService } from './sweep.service';
import { SquadService } from '../squad/squad.service';
import { MonoConfig } from '../../config/config';
import type { MonoConfigType } from '../../config/config.types';
import { ReceivedResponseDto } from '../../common/dto/common-responses.dto';
import { db } from '../../db';
import { businessProfiles } from '../../db/schema';
import { eq } from 'drizzle-orm';

@ApiTags('webhooks')
@Controller('webhooks')
export class SweepController {
  private readonly logger = new Logger(SweepController.name);

  constructor(
    private sweepService: SweepService,
    private squadService: SquadService,
    @Inject(MonoConfig.KEY) private monoCfg: MonoConfigType,
  ) {}

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

  @Post('mono')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Mono income webhook — updates business monthly inflow when Mono income processing completes',
  })
  @ApiHeader({
    name: 'mono-webhook-secret',
    description: 'Shared secret configured in the Mono dashboard for webhook verification',
    required: false,
  })
  @ApiBody({
    description:
      'Mono webhook payload. Handles mono.events.account_income: updates monoAverageMonthlyInflow on the matching business profile.',
    schema: {
      type: 'object',
      properties: {
        event: { type: 'string', example: 'mono.events.account_income' },
        event_id: { type: 'string', example: 'evt_12345abcde' },
        data: {
          type: 'object',
          properties: {
            account: { type: 'string', example: '64ef3...' },
            income_summary: {
              type: 'object',
              properties: {
                monthly_income: { type: 'number', example: 45000000, description: 'In kobo' },
                total_income: { type: 'number', example: 45000000 },
                annual_income: { type: 'number', example: 540000000 },
                employer: { type: 'string', example: 'Acme Ltd' },
                income_source_type: { type: 'string', example: 'BANK' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, type: ReceivedResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid webhook secret' })
  async handleMonoWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('mono-webhook-secret') secret: string,
  ) {
    const configuredSecret = this.monoCfg.webhookSecret;
    if (configuredSecret && secret) {
      try {
        const valid = crypto.timingSafeEqual(
          Buffer.from(secret),
          Buffer.from(configuredSecret),
        );
        if (!valid) {
          this.logger.warn('Invalid Mono webhook secret');
          throw new UnauthorizedException('Invalid webhook secret');
        }
      } catch (e) {
        if (e instanceof UnauthorizedException) throw e;
        // timingSafeEqual throws if buffers differ in length
        this.logger.warn('Invalid Mono webhook secret');
        throw new UnauthorizedException('Invalid webhook secret');
      }
    }

    const payload = req.body as Record<string, unknown>;
    const event = payload.event as string;

    if (event === 'mono.events.account_income') {
      const data = payload.data as Record<string, unknown>;
      const accountId = data?.account as string;
      const incomeSummary = data?.income_summary as Record<string, unknown>;
      const monthlyIncome = Number(incomeSummary?.monthly_income ?? 0);

      if (accountId && monthlyIncome > 0) {
        await db
          .update(businessProfiles)
          .set({ monoAverageMonthlyInflow: monthlyIncome, updatedAt: new Date() })
          .where(eq(businessProfiles.monoAccountId, accountId));

        this.logger.log(
          `Income updated for account ${accountId}: ${monthlyIncome} kobo/month`,
        );
      }
    }

    return { received: true };
  }
}
