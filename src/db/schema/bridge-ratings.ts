import { pgTable, uuid, numeric, timestamp } from 'drizzle-orm/pg-core';
import { businessProfiles } from './business-profiles';
import { bridgeStandingEnum } from './enums';

// One rating record per business; recalculated after every sweep and on a daily cron
export const bridgeRatings = pgTable('bridge_ratings', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businessProfiles.id)
    .unique()
    .notNull(),
  overallScore: numeric('overall_score', { precision: 5, scale: 2 })
    .notNull()
    .default('0'),
  standing: bridgeStandingEnum('standing').default('Seed'),
  repaymentSpeedScore: numeric('repayment_speed_score', {
    precision: 5,
    scale: 2,
  }).default('0'),
  repaymentConsistencyScore: numeric('repayment_consistency_score', {
    precision: 5,
    scale: 2,
  }).default('0'),
  transactionVolumeScore: numeric('transaction_volume_score', {
    precision: 5,
    scale: 2,
  }).default('0'),
  revenueConsistencyScore: numeric('revenue_consistency_score', {
    precision: 5,
    scale: 2,
  }).default('0'),
  cacBonusScore: numeric('cac_bonus_score', { precision: 5, scale: 2 }).default(
    '0',
  ),
  communicationScore: numeric('communication_score', {
    precision: 5,
    scale: 2,
  }).default('0'),
  lastCalculatedAt: timestamp('last_calculated_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type BridgeRating = typeof bridgeRatings.$inferSelect;
