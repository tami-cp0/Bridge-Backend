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
import { LedgerService } from '../ledger/ledger.service';
import { SquadConfig } from '../../config/config';
import type { SquadConfigType } from '../../config/config.types';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { users } from '../../db/schema';
import {
  InitiatePayoutDto,
  RequeryPayoutDto,
} from './dto/payout-requests.dto';

const FINAL_STATUSES = new Set(['success', 'failed', 'reversed']);
const SUCCESS_STATUSES = new Set(['success']);

function formatNaira(amountKobo: number): string {
  return (amountKobo / 100).toLocaleString('en-NG');
}

@Injectable()
export class PayoutsService {
  constructor(
    private squadService: SquadService,
    private ledgerService: LedgerService,
    @Inject(SquadConfig.KEY) private squadCfg: SquadConfigType,
  ) {}



  async initiatePayout(user: JwtPayload, dto: InitiatePayoutDto) {
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount must be a positive number in kobo');
    }

    const balance = await this.ledgerService.getAvailableBalance(user.userId);
    if (balance < amount) {
      throw new BadRequestException(
        `Insufficient balance. Available: ₦${formatNaira(balance)}`,
      );
    }

    const [dbUser] = await db
      .select({
        beneficiaryAccount: users.beneficiaryAccount,
      })
      .from(users)
      .where(eq(users.id, user.userId));

    if (!dbUser || !dbUser.beneficiaryAccount) {
      throw new BadRequestException(
        'Beneficiary account not set for this user',
      );
    }

    const bankCode = '058'; // GTBank is the static default for Bridge
    const accountNumber = dbUser.beneficiaryAccount;
    const remark = 'Bridge Withdrawal';

    let accountName = 'Unknown';
    try {
      const lookupResult = await this.squadService.lookupAccount(bankCode, accountNumber);
      accountName = lookupResult.accountName;
    } catch (e) {
      throw new BadRequestException('Failed to verify beneficiary account details with the bank');
    }

    const merchantId = this.squadCfg.merchantId;
    if (!merchantId) {
      throw new InternalServerErrorException(
        'SQUAD_MERCHANT_ID is not configured',
      );
    }

    const reference = `${merchantId}_${uuidv4()}`;

    // Atomically debit the ledger and record the payout row. If anything
    // inside the transaction throws, Postgres rolls back both writes so the
    // user's balance is never reduced without a matching payout record.
    // The Squad API call happens outside the transaction — network calls
    // cannot be rolled back — but we wrap it in a try/catch and reverse the
    // ledger debit if Squad throws or returns a terminal failure.
    let response: Awaited<ReturnType<SquadService['initiateTransfer']>>;

    await db.transaction(async (tx) => {
      await this.ledgerService.debit(
        {
          userId: user.userId,
          amount,
          purpose: 'payout',
          referenceType: 'payout',
          squadTransactionReference: reference,
        },
        tx,
      );

      // Placeholder row — status updated below once we hear from Squad.
      await tx
        .insert(payouts)
        .values({
          userId: user.userId,
          userType: user.userType,
          amount,
          bankCode,
          accountNumber,
          accountName,
          transactionReference: reference,
          remark,
          status: 'pending',
          squadStatus: 'pending',
          updatedAt: new Date(),
        });
    });

    try {
      response = await this.squadService.initiateTransfer(
        amount,
        bankCode,
        accountNumber,
        accountName,
        reference,
        remark,
      );
    } catch (err) {
      // Squad unreachable or threw — reverse the ledger debit.
      await this.ledgerService.credit({
        userId: user.userId,
        amount,
        purpose: 'payout_reversed',
        referenceType: 'payout',
        squadTransactionReference: `${reference}_reversal`,
      });
      await db
        .update(payouts)
        .set({ status: 'failed', squadStatus: 'Squad API error', updatedAt: new Date() })
        .where(eq(payouts.transactionReference, reference));
      throw err;
    }

    // Persist the real Squad reference and status returned from the API.
    const [updated] = await db
      .update(payouts)
      .set({
        transactionReference: response.transactionReference,
        status: response.status,
        squadStatus: response.responseDescription,
        updatedAt: new Date(),
      })
      .where(eq(payouts.transactionReference, reference))
      .returning();

    // If Squad already returned a terminal failure on the initial call,
    // refund the ledger now so the user isn't locked out of their funds.
    if (response.status === 'failed' || response.status === 'reversed') {
      await this.ledgerService.credit({
        userId: user.userId,
        amount,
        purpose: 'payout_reversed',
        referenceType: 'payout',
        squadTransactionReference: `${reference}_reversal`,
      });
    }

    await db.insert(notifications).values({
      userId: user.userId,
      title: `₦${formatNaira(amount)} payout initiated`,
      body: `Payout of ₦${formatNaira(amount)} to ${accountName} has been initiated.`,
    });

    return {
      id: updated.id,
      transactionReference: updated.transactionReference,
      status: updated.status,
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
    const normalized = result.status.toLowerCase();
    const now = new Date();

    const updates: Partial<typeof payouts.$inferInsert> = {
      status: normalized,
      squadStatus: result.responseDescription,
      updatedAt: now,
    };

    if (FINAL_STATUSES.has(normalized)) {
      updates.completedAt = now;
    }

    await db.update(payouts).set(updates).where(eq(payouts.id, existing.id));

    // Reverse the ledger debit if the payout terminally failed. Use a
    // distinct squad_transaction_reference suffix so a redelivered failure
    // doesn't double-refund.
    const reversalRef = `${existing.transactionReference}_reversal`;
    if (
      FINAL_STATUSES.has(normalized) &&
      !SUCCESS_STATUSES.has(normalized) &&
      !existing.completedAt &&
      !(await this.ledgerService.hasEntryForSquadReference(reversalRef))
    ) {
      await this.ledgerService.credit({
        userId: existing.userId,
        amount: existing.amount,
        purpose: 'payout_reversed',
        referenceType: 'payout',
        squadTransactionReference: reversalRef,
      });
    }

    if (FINAL_STATUSES.has(normalized) && !existing.completedAt) {
      const isSuccess = SUCCESS_STATUSES.has(normalized);
      await db.insert(notifications).values({
        userId: user.userId,
        title: isSuccess ? `₦${formatNaira(existing.amount)} payout completed` : `₦${formatNaira(existing.amount)} payout failed`,
        body: isSuccess
          ? `Payout of ₦${formatNaira(existing.amount)} has completed.`
          : `Payout of ₦${formatNaira(existing.amount)} failed and your balance was restored.`,
      });
    }

    return {
      transactionReference: existing.transactionReference,
      status: normalized,
      squadStatus: result.responseDescription,
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
