import {
  pgTable,
  uuid,
  bigint,
  numeric,
  varchar,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { listings } from './listings';

// One record per incoming payment that triggered a revenue sweep
export const sweepEvents = pgTable('sweep_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .references(() => listings.id)
    .notNull(),
  incomingPaymentAmount: bigint('incoming_payment_amount', {
    mode: 'number',
  }).notNull(),
  sweepPercent: numeric('sweep_percent', { precision: 5, scale: 2 }).notNull(),
  sweepAmount: bigint('sweep_amount', { mode: 'number' }).notNull(),
  serviceFee: bigint('service_fee', { mode: 'number' }).default(0).notNull(),
  netAmountRetained: bigint('net_amount_retained', {
    mode: 'number',
  }).notNull(),
  squadWebhookReference: varchar('squad_webhook_reference', {
    length: 100,
  }).notNull(),
  isManualRepayment: boolean('is_manual_repayment').default(false).notNull(),
  processedAt: timestamp('processed_at').defaultNow().notNull(),
});

export type SweepEvent = typeof sweepEvents.$inferSelect;
