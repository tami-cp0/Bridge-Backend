import {
  pgTable,
  uuid,
  varchar,
  integer,
  bigint,
  text,
  boolean,
  timestamp,
  date,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// Extended profile for business owners — one-to-one with users
export const businessProfiles = pgTable('business_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .unique()
    .notNull(),
  businessName: varchar('business_name', { length: 255 }).notNull(),
  sector: varchar('sector', { length: 100 }).notNull(),
  location: varchar('location', { length: 255 }).notNull(),
  yearsInOperation: integer('years_in_operation').notNull(),
  averageMonthlyRevenue: bigint('average_monthly_revenue', {
    mode: 'number',
  }).notNull(),
  businessDescription: text('business_description').notNull(),
  cacRegistrationNumber: varchar('cac_registration_number', { length: 100 }),
  cacVerified: boolean('cac_verified').default(false),
  bankConnected: boolean('bank_connected').default(false),
  monoAccountId: varchar('mono_account_id', { length: 100 }),
  monoLinked: boolean('mono_linked').default(false),
  monoAverageMonthlyInflow: bigint('mono_average_monthly_inflow', {
    mode: 'number',
  }),
  monoHistoryStartDate: date('mono_history_start_date'),
  tier: integer('tier').default(1),
  completedRepaymentCount: integer('completed_repayment_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type BusinessProfile = typeof businessProfiles.$inferSelect;
