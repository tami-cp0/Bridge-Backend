import {
  pgTable,
  pgEnum,
  uuid,
  bigint,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', [
  'credit',
  'debit',
]);

// Tracks each user's share of the Squad merchant wallet. Squad has no VA-to-VA
// transfer; all incoming money lands in one merchant ledger, so ownership is
// modelled here. balance(user) = sum(credits) - sum(debits).
export const internalLedgerEntries = pgTable(
  'internal_ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    entryType: ledgerEntryTypeEnum('entry_type').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    purpose: varchar('purpose', { length: 40 }).notNull(),
    referenceId: uuid('reference_id'),
    referenceType: varchar('reference_type', { length: 40 }),
    squadTransactionReference: varchar('squad_transaction_reference', {
      length: 120,
    }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    userIdx: index('internal_ledger_user_idx').on(t.userId),
    squadRefIdx: index('internal_ledger_squad_ref_idx').on(
      t.squadTransactionReference,
    ),
  }),
);

export type InternalLedgerEntry = typeof internalLedgerEntries.$inferSelect;
