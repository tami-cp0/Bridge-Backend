import {
  pgTable,
  integer,
  bigint,
  numeric,
  timestamp,
} from 'drizzle-orm/pg-core';

// Single-row aggregate updated nightly by the scheduler; id is always 1
export const platformStats = pgTable('platform_stats', {
  id: integer('id').primaryKey().default(1),
  totalBusinessesFunded: integer('total_businesses_funded').default(0),
  totalCapitalDeployedKobo: bigint('total_capital_deployed_kobo', {
    mode: 'number',
  }).default(0),
  averageInvestorReturnPercent: numeric('average_investor_return_percent', {
    precision: 5,
    scale: 2,
  }).default('0'),
  averageRepaymentDays: integer('average_repayment_days').default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type PlatformStat = typeof platformStats.$inferSelect;
