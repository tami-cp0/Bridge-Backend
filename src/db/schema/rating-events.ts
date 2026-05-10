import {
  pgTable,
  uuid,
  numeric,
  varchar,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';
import { businessProfiles } from './business-profiles';

// Audit log — every time the Bridge Rating changes, a snapshot is stored here
export const ratingEvents = pgTable('rating_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businessProfiles.id)
    .notNull(),
  previousScore: numeric('previous_score', {
    precision: 5,
    scale: 2,
  }).notNull(),
  newScore: numeric('new_score', { precision: 5, scale: 2 }).notNull(),
  previousStanding: varchar('previous_standing', { length: 20 }).notNull(),
  newStanding: varchar('new_standing', { length: 20 }).notNull(),
  triggerType: varchar('trigger_type', { length: 50 }).notNull(),
  triggerId: varchar('trigger_id', { length: 100 }),
  inputSnapshot: jsonb('input_snapshot').notNull(),
  calculatedAt: timestamp('calculated_at').defaultNow(),
});

export type RatingEvent = typeof ratingEvents.$inferSelect;
