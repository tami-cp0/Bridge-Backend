import {
  pgTable,
  uuid,
  bigint,
  text,
  numeric,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { businessProfiles } from './business-profiles';
import { listingStatusEnum } from './enums';

// A fundraising campaign — a business can only have one active/funded listing at a time
export const listings = pgTable('listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businessProfiles.id)
    .notNull(),
  capitalRequested: bigint('capital_requested', { mode: 'number' }).notNull(),
  useOfFunds: text('use_of_funds').notNull(),
  expectedImpact: text('expected_impact').notNull(),
  revenueSharePercent: numeric('revenue_share_percent', {
    precision: 5,
    scale: 2,
  }).notNull(),
  totalReturnAmount: bigint('total_return_amount', {
    mode: 'number',
  }).notNull(),
  totalReturnPercent: numeric('total_return_percent', {
    precision: 5,
    scale: 2,
  }).notNull(),
  targetRepaymentMonths: integer('target_repayment_months').notNull(),
  aiProfile: text('ai_profile').notNull(),
  generatedProfile: text('generated_profile'),
  status: listingStatusEnum('status').default('active'),
  totalCommitted: bigint('total_committed', { mode: 'number' }).default(0),
  totalSwept: bigint('total_swept', { mode: 'number' }).default(0),
  investorCount: integer('investor_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type Listing = typeof listings.$inferSelect;
