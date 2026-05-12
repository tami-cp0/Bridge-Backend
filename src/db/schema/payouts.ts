import {
  pgTable,
  uuid,
  varchar,
  bigint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { userTypeEnum } from './enums';

// Outbound transfers to a user's bank account
export const payouts = pgTable('payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  userType: userTypeEnum('user_type').notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  bankCode: varchar('bank_code', { length: 10 }).notNull(),
  accountNumber: varchar('account_number', { length: 10 }).notNull(),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  transactionReference: varchar('transaction_reference', { length: 120 })
    .notNull()
    .unique(),
  remark: text('remark').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('pending'),
  squadStatus: varchar('squad_status', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

export type Payout = typeof payouts.$inferSelect;
