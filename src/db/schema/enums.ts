import { pgEnum } from 'drizzle-orm/pg-core';

export const userTypeEnum = pgEnum('user_type', ['business', 'investor']);

export const listingStatusEnum = pgEnum('listing_status', [
  'active', // open for investment
  'funded', // fully committed, capital disbursed in tranches, sweeping in progress
  'completed', // total return paid back to all investors
  'defaulted', // exceeded MAX_DEAL_DURATION_MONTHS without completing
]);

export const investmentStatusEnum = pgEnum('investment_status', [
  'inactive', // listing not yet fully funded
  'active',   // repayment in progress
  'completed',
  'defaulted',
]);

export const trancheStatusEnum = pgEnum('tranche_status', [
  'locked', // not yet released to business
  'released', // sent to business virtual account
  'returned', // returned to escrow (unused)
]);

export const bridgeStandingEnum = pgEnum('bridge_standing', [
  'Seed', // 0–49
  'Established', // 50–79
  'Elite', // 80–100
]);
