import {
  pgTable,
  uuid,
  varchar,
  bigint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// Extended profile for investors — stores matching preferences
export const investorProfiles = pgTable('investor_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .unique()
    .notNull(),
  sectorInterests: text('sector_interests').array(),
  riskTierPreference: varchar('risk_tier_preference', { length: 20 }),
  returnTimelinePreference: varchar('return_timeline_preference', {
    length: 20,
  }),
  investmentRangeMin: bigint('investment_range_min', { mode: 'number' }),
  investmentRangeMax: bigint('investment_range_max', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type InvestorProfile = typeof investorProfiles.$inferSelect;
