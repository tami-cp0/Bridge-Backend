import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import { payouts, notifications } from '../../db/schema';
import { eq, desc, asc, and, count } from 'drizzle-orm';
import { SquadService } from '../squad/squad.service';
import { SquadConfig } from '../../config/config';
import type { SquadConfigType } from '../../config/config.types';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import {
  AccountLookupDto,
  InitiatePayoutDto,
  RequeryPayoutDto,
} from './dto/payout-requests.dto';

const FINAL_STATUSES = new Set([
  'success',
  'successful',
  'completed',
  'failed',
  'reversed',
]);

const SUCCESS_STATUSES = new Set(['success', 'successful', 'completed']);

function formatNaira(amountKobo: number): string {
  return (amountKobo / 100).toLocaleString('en-NG');
}

@Injectable()
export class PayoutsService {
  constructor(
    private squadService: SquadService,
    @Inject(SquadConfig.KEY) private squadCfg: SquadConfigType,
  ) {}

  async lookupAccount(dto: AccountLookupDto) {
    const result = await this.squadService.lookupAccount(
      dto.bankCode,
      dto.accountNumber,
    );
    return {
      bankCode: dto.bankCode,
      accountNumber: dto.accountNumber,
      accountName: result.accountName,
    };
  }

  async initiatePayout(user: JwtPayload, dto: InitiatePayoutDto) {
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount must be a positive number in kobo');
    }

    const merchantId = this.squadCfg.merchantId;
    if (!merchantId) {
      throw new InternalServerErrorException(
        'SQUAD_MERCHANT_ID is not configured',
      );
    }

    const reference = `${merchantId}_${uuidv4()}`;
    const response = await this.squadService.initiateTransfer(
      amount,
      dto.bankCode,
      dto.accountNumber,
      dto.accountName,
      reference,
      dto.remark,
    );

    const status = String(response.status ?? 'pending');
    const [created] = await db
      .insert(payouts)
      .values({
        userId: user.userId,
        userType: user.userType,
        amount,
        bankCode: dto.bankCode,
        accountNumber: dto.accountNumber,
        accountName: dto.accountName,
        transactionReference: response.transactionReference,
        remark: dto.remark,
        status,
        squadStatus: status,
        updatedAt: new Date(),
      })
      .returning();

    await db.insert(notifications).values({
      userId: user.userId,
      title: 'Payout initiated',
      body: `Payout of NGN ${formatNaira(amount)} to ${dto.accountName} has been initiated.`,
    });

    return {
      id: created.id,
      transactionReference: created.transactionReference,
      status: created.status,
    };
  }

  async requeryPayout(user: JwtPayload, dto: RequeryPayoutDto) {
    const [existing] = await db
      .select()
      .from(payouts)
      .where(
        and(
          eq(payouts.userId, user.userId),
          eq(payouts.transactionReference, dto.transactionReference),
        ),
      );

    if (!existing) throw new NotFoundException('Payout not found');

    const result = await this.squadService.requeryTransfer(
      dto.transactionReference,
    );
    const status = String(result.status ?? 'unknown');
    const normalized = status.toLowerCase();
    const now = new Date();

    const updates: Partial<typeof payouts.$inferInsert> = {
      status,
      squadStatus: status,
      updatedAt: now,
    };

    if (FINAL_STATUSES.has(normalized)) {
      updates.completedAt = now;
    }

    await db.update(payouts).set(updates).where(eq(payouts.id, existing.id));

    if (FINAL_STATUSES.has(normalized) && !existing.completedAt) {
      const isSuccess = SUCCESS_STATUSES.has(normalized);
      await db.insert(notifications).values({
        userId: user.userId,
        title: isSuccess ? 'Payout completed' : 'Payout failed',
        body: isSuccess
          ? `Payout of NGN ${formatNaira(existing.amount)} has completed.`
          : `Payout of NGN ${formatNaira(existing.amount)} failed or was reversed.`,
      });
    }

    return {
      transactionReference: existing.transactionReference,
      status,
      squadStatus: status,
      updatedAt: now,
    };
  }

  async listPayouts(
    user: JwtPayload,
    page = 1,
    perPage = 10,
    dir: 'ASC' | 'DESC' = 'DESC',
  ) {
    const safePage = Number.isFinite(page) ? page : 1;
    const safePerPage = Number.isFinite(perPage) ? perPage : 10;
    const limit = Math.min(Math.max(safePerPage, 1), 100);
    const offset = (Math.max(safePage, 1) - 1) * limit;
    const orderBy =
      dir === 'ASC' ? asc(payouts.createdAt) : desc(payouts.createdAt);

    const [totalRow] = await db
      .select({ value: count() })
      .from(payouts)
      .where(eq(payouts.userId, user.userId));

    const total = Number(totalRow?.value ?? 0);

    const data = await db
      .select()
      .from(payouts)
      .where(eq(payouts.userId, user.userId))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return {
      data,
      page: Math.max(safePage, 1),
      perPage: limit,
      total,
    };
  }
}
