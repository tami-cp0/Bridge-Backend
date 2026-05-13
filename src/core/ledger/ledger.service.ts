import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { sql, eq, and } from 'drizzle-orm';
import { db } from '../../db';
import type { Db } from '../../db';
import { internalLedgerEntries, users } from '../../db/schema';

type TxOrDb = Parameters<Parameters<Db['transaction']>[0]>[0] | Db;

export type LedgerPurpose =
  | 'deposit' // investor/business funded their VA (incoming Squad webhook)
  | 'investment_commit' // investor debit, capital locked into a listing
  | 'tranche_release' // business credit when capital tranche is owed
  | 'tranche_payout' // business debit when capital is paid out to their bank
  | 'sweep_contribution' // business debit, portion of incoming revenue owed to investors/platform
  | 'sweep_distribution' // investor credit from sweep
  | 'default_pool' // investor debit, 4% protection contribution
  | 'service_fee' // platform revenue
  | 'payout' // user debit when withdrawing to their bank
  | 'payout_reversed'; // user credit when payout fails/reverses

export interface LedgerEntryInput {
  userId: string;
  amount: number;
  purpose: LedgerPurpose;
  referenceId?: string;
  referenceType?: string;
  squadTransactionReference?: string;
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  async getSystemUserId(tx?: TxOrDb): Promise<string> {
    const executor = tx ?? db;
    const SYSTEM_EMAIL = 'system@bridge.app';
    const SYSTEM_PHONE = '07047000000';
    const [existing] = await executor.select().from(users).where(eq(users.email, SYSTEM_EMAIL));
    if (existing) return existing.id;
    
    const [systemUser] = await executor.insert(users).values({
      fullName: 'Bridge Platform',
      email: SYSTEM_EMAIL,
      phone: SYSTEM_PHONE,
      passwordHash: 'system',
      userType: 'business',
      beneficiaryAccount: '0000000000',
    }).returning();
    return systemUser.id;
  }

  async credit(input: LedgerEntryInput, tx?: TxOrDb) {
    if (input.amount <= 0) {
      throw new BadRequestException(
        `Ledger credit amount must be positive: ${input.amount}`,
      );
    }
    const executor = tx ?? db;
    const [row] = await executor
      .insert(internalLedgerEntries)
      .values({
        userId: input.userId,
        entryType: 'credit',
        amount: input.amount,
        purpose: input.purpose,
        referenceId: input.referenceId,
        referenceType: input.referenceType,
        squadTransactionReference: input.squadTransactionReference,
      })
      .returning();
    return row;
  }

  async debit(input: LedgerEntryInput, tx?: TxOrDb) {
    if (input.amount <= 0) {
      throw new BadRequestException(
        `Ledger debit amount must be positive: ${input.amount}`,
      );
    }
    const executor = tx ?? db;
    const [row] = await executor
      .insert(internalLedgerEntries)
      .values({
        userId: input.userId,
        entryType: 'debit',
        amount: input.amount,
        purpose: input.purpose,
        referenceId: input.referenceId,
        referenceType: input.referenceType,
        squadTransactionReference: input.squadTransactionReference,
      })
      .returning();
    return row;
  }

  async getAvailableBalance(userId: string): Promise<number> {
    const [row] = await db
      .select({
        credits: sql<string>`COALESCE(SUM(CASE WHEN ${internalLedgerEntries.entryType} = 'credit' THEN ${internalLedgerEntries.amount} ELSE 0 END), 0)`,
        debits: sql<string>`COALESCE(SUM(CASE WHEN ${internalLedgerEntries.entryType} = 'debit'  THEN ${internalLedgerEntries.amount} ELSE 0 END), 0)`,
      })
      .from(internalLedgerEntries)
      .where(eq(internalLedgerEntries.userId, userId));
    const credits = Number(row?.credits ?? 0);
    const debits = Number(row?.debits ?? 0);
    return credits - debits;
  }

  // Idempotency check used by the Squad webhook so a redelivered event doesn't double-credit
  async hasEntryForSquadReference(reference: string): Promise<boolean> {
    const rows = await db
      .select({ id: internalLedgerEntries.id })
      .from(internalLedgerEntries)
      .where(eq(internalLedgerEntries.squadTransactionReference, reference))
      .limit(1);
    return rows.length > 0;
  }

  async sumByPurpose(userId: string, purpose: LedgerPurpose): Promise<number> {
    const [row] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${internalLedgerEntries.amount}), 0)`,
      })
      .from(internalLedgerEntries)
      .where(
        and(
          eq(internalLedgerEntries.userId, userId),
          eq(internalLedgerEntries.purpose, purpose),
        ),
      );
    return Number(row?.total ?? 0);
  }
}
