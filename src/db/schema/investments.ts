import {
  pgTable,
  uuid,
  bigint,
  numeric,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core';
import { listings } from './listings';
import { users } from './users';
import { investmentStatusEnum } from './enums';

// A single investor's stake in a listing; amountCommitted is in kobo
export const investments = pgTable('investments', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .references(() => listings.id)
    .notNull(),
  investorId: uuid('investor_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  amountCommitted: bigint('amount_committed', { mode: 'number' }).notNull(),
  defaultPoolContribution: bigint('default_pool_contribution', {
    mode: 'number',
  }).notNull(),
  sharePercent: numeric('share_percent', { precision: 8, scale: 4 }).notNull(),
  totalReturnDue: bigint('total_return_due', { mode: 'number' }).notNull(),
  totalReturnReceived: bigint('total_return_received', {
    mode: 'number',
  }).default(0),
  status: investmentStatusEnum('status').default('active'),
  squadTransferReference: varchar('squad_transfer_reference', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type Investment = typeof investments.$inferSelect;
