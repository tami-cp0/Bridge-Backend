import { pgTable, uuid, bigint, varchar, timestamp } from 'drizzle-orm/pg-core';
import { sweepEvents } from './sweep-events';
import { investments } from './investments';

// Tracks how each sweep was split among investors (one row per investor per sweep)
export const sweepDistributions = pgTable('sweep_distributions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sweepEventId: uuid('sweep_event_id')
    .references(() => sweepEvents.id)
    .notNull(),
  investmentId: uuid('investment_id')
    .references(() => investments.id)
    .notNull(),
  amountDistributed: bigint('amount_distributed', { mode: 'number' }).notNull(),
  squadTransferReference: varchar('squad_transfer_reference', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export type SweepDistribution = typeof sweepDistributions.$inferSelect;
