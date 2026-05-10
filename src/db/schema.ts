import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  integer,
  bigint,
  text,
  numeric,
  date,
  pgEnum,
  jsonb,
} from 'drizzle-orm/pg-core';

// --- Enums ---
export const userTypeEnum = pgEnum('user_type', ['business', 'investor']);
export const listingStatusEnum = pgEnum('listing_status', [
  'active',    // open for investment
  'funded',    // fully committed, capital disbursed in tranches, sweeping in progress
  'completed', // total return paid back to all investors
  'defaulted', // exceeded MAX_DEAL_DURATION_MONTHS without completing
]);
export const investmentStatusEnum = pgEnum('investment_status', [
  'active',
  'completed',
  'defaulted',
]);
export const trancheStatusEnum = pgEnum('tranche_status', [
  'locked',   // not yet released to business
  'released', // sent to business virtual account
  'returned', // returned to escrow (unused)
]);
export const bridgeStandingEnum = pgEnum('bridge_standing', [
  'Seed',        // 0–49
  'Established', // 50–79
  'Elite',       // 80–100
]);

// --- Tables ---

// Shared user identity — both businesses and investors live here
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  phone: varchar('phone', { length: 20 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  userType: userTypeEnum('user_type').notNull(),
  bvnVerified: boolean('bvn_verified').default(false),
  bvnHash: varchar('bvn_hash', { length: 255 }),
  squadVirtualAccountNumber: varchar('squad_virtual_account_number', { length: 50 }),
  squadVirtualAccountReference: varchar('squad_virtual_account_reference', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

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
  averageMonthlyRevenue: bigint('average_monthly_revenue', { mode: 'number' }).notNull(),
  businessDescription: text('business_description').notNull(),
  cacRegistrationNumber: varchar('cac_registration_number', { length: 100 }),
  cacVerified: boolean('cac_verified').default(false),
  monoAccountId: varchar('mono_account_id', { length: 100 }),
  monoLinked: boolean('mono_linked').default(false),
  monoAverageMonthlyInflow: bigint('mono_average_monthly_inflow', { mode: 'number' }),
  monoHistoryStartDate: date('mono_history_start_date'),
  tier: integer('tier').default(1),
  completedRepaymentCount: integer('completed_repayment_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Extended profile for investors — stores matching preferences
export const investorProfiles = pgTable('investor_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .unique()
    .notNull(),
  sectorInterests: text('sector_interests').array(),
  riskTierPreference: varchar('risk_tier_preference', { length: 20 }),
  returnTimelinePreference: varchar('return_timeline_preference', { length: 20 }),
  investmentRangeMin: bigint('investment_range_min', { mode: 'number' }),
  investmentRangeMax: bigint('investment_range_max', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// One rating record per business; recalculated after every sweep and on a daily cron
export const bridgeRatings = pgTable('bridge_ratings', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businessProfiles.id)
    .unique()
    .notNull(),
  overallScore: numeric('overall_score', { precision: 5, scale: 2 }).notNull().default('0'),
  standing: bridgeStandingEnum('standing').default('Seed'),
  repaymentSpeedScore: numeric('repayment_speed_score', { precision: 5, scale: 2 }).default('0'),
  repaymentConsistencyScore: numeric('repayment_consistency_score', { precision: 5, scale: 2 }).default('0'),
  transactionVolumeScore: numeric('transaction_volume_score', { precision: 5, scale: 2 }).default('0'),
  revenueConsistencyScore: numeric('revenue_consistency_score', { precision: 5, scale: 2 }).default('0'),
  cacBonusScore: numeric('cac_bonus_score', { precision: 5, scale: 2 }).default('0'),
  communicationScore: numeric('communication_score', { precision: 5, scale: 2 }).default('0'),
  lastCalculatedAt: timestamp('last_calculated_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// A fundraising campaign — a business can only have one active/funded listing at a time
export const listings = pgTable('listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businessProfiles.id)
    .notNull(),
  capitalRequested: bigint('capital_requested', { mode: 'number' }).notNull(),
  useOfFunds: text('use_of_funds').notNull(),
  expectedImpact: text('expected_impact').notNull(),
  revenueSharePercent: numeric('revenue_share_percent', { precision: 5, scale: 2 }).notNull(),
  totalReturnAmount: bigint('total_return_amount', { mode: 'number' }).notNull(),
  totalReturnPercent: numeric('total_return_percent', { precision: 5, scale: 2 }).notNull(),
  targetRepaymentMonths: integer('target_repayment_months').notNull(),
  aiProfile: text('ai_profile').notNull(),
  status: listingStatusEnum('status').default('active'),
  totalCommitted: bigint('total_committed', { mode: 'number' }).default(0),
  totalSwept: bigint('total_swept', { mode: 'number' }).default(0),
  investorCount: integer('investor_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// A single investor's stake in a listing; amountCommitted is in kobo
export const investments = pgTable('investments', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .references(() => listings.id)
    .notNull(),
  investorId: uuid('investor_id')
    .references(() => users.id)
    .notNull(),
  amountCommitted: bigint('amount_committed', { mode: 'number' }).notNull(),
  defaultPoolContribution: bigint('default_pool_contribution', { mode: 'number' }).notNull(),
  sharePercent: numeric('share_percent', { precision: 8, scale: 4 }).notNull(),
  totalReturnDue: bigint('total_return_due', { mode: 'number' }).notNull(),
  totalReturnReceived: bigint('total_return_received', { mode: 'number' }).default(0),
  status: investmentStatusEnum('status').default('active'),
  squadTransferReference: varchar('squad_transfer_reference', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

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

// One record per incoming payment that triggered a revenue sweep
export const sweepEvents = pgTable('sweep_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .references(() => listings.id)
    .notNull(),
  incomingPaymentAmount: bigint('incoming_payment_amount', { mode: 'number' }).notNull(),
  sweepPercent: numeric('sweep_percent', { precision: 5, scale: 2 }).notNull(),
  sweepAmount: bigint('sweep_amount', { mode: 'number' }).notNull(),
  netAmountRetained: bigint('net_amount_retained', { mode: 'number' }).notNull(),
  squadWebhookReference: varchar('squad_webhook_reference', { length: 100 }).notNull(),
  processedAt: timestamp('processed_at').defaultNow().notNull(),
});

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

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  read: boolean('read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Audit log — every time the Bridge Rating changes, a snapshot is stored here
export const ratingEvents = pgTable('rating_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businessProfiles.id)
    .notNull(),
  previousScore: numeric('previous_score', { precision: 5, scale: 2 }).notNull(),
  newScore: numeric('new_score', { precision: 5, scale: 2 }).notNull(),
  previousStanding: varchar('previous_standing', { length: 20 }).notNull(),
  newStanding: varchar('new_standing', { length: 20 }).notNull(),
  triggerType: varchar('trigger_type', { length: 50 }).notNull(),
  triggerId: varchar('trigger_id', { length: 100 }),
  inputSnapshot: jsonb('input_snapshot').notNull(),
  calculatedAt: timestamp('calculated_at').defaultNow(),
});

// Single-row aggregate updated nightly by the scheduler; id is always 1
export const platformStats = pgTable('platform_stats', {
  id: integer('id').primaryKey().default(1),
  totalBusinessesFunded: integer('total_businesses_funded').default(0),
  totalCapitalDeployedKobo: bigint('total_capital_deployed_kobo', { mode: 'number' }).default(0),
  averageInvestorReturnPercent: numeric('average_investor_return_percent', { precision: 5, scale: 2 }).default('0'),
  averageRepaymentDays: integer('average_repayment_days').default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// --- Inferred TypeScript types for each table row ---
export type User = typeof users.$inferSelect;
export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type InvestorProfile = typeof investorProfiles.$inferSelect;
export type BridgeRating = typeof bridgeRatings.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type Investment = typeof investments.$inferSelect;
export type Tranche = typeof tranches.$inferSelect;
export type SweepEvent = typeof sweepEvents.$inferSelect;
export type SweepDistribution = typeof sweepDistributions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type RatingEvent = typeof ratingEvents.$inferSelect;
export type PlatformStat = typeof platformStats.$inferSelect;
