import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { userTypeEnum } from './enums';

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

export type User = typeof users.$inferSelect;
