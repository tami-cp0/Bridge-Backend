import { pgTable, uuid, integer, bigint, text, varchar, timestamp } from 'drizzle-orm/pg-core';
import { listings } from './listings';
import { trancheStatusEnum } from './enums';

// Capital is disbursed in 3 tranches (40% / 30% / 30%) unlocked by sweep milestones
export const tranches = pgTable('tranches', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .references(() => listings.id)
    .notNull(),
  trancheNumber: integer('tranche_number').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  status: trancheStatusEnum('status').default('locked'),
  releaseCondition: text('release_condition').notNull(),
  releasedAt: timestamp('released_at'),
  squadTransferReference: varchar('squad_transfer_reference', { length: 100 }),
});

export type Tranche = typeof tranches.$inferSelect;
