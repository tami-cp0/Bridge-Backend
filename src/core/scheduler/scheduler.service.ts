import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppConfig } from '../../config/config';
import type { AppConfigType } from '../../config/config.types';
import { db } from '../../db';
import {
  businessProfiles,
  listings,
  platformStats,
  investments,
  users,
} from '../../db/schema';
import { eq, and, or, lte, sum, count } from 'drizzle-orm';
import { BridgeRatingService } from '../bridge-rating/bridge-rating.service';
import { SquadService } from '../squad/squad.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private simulationStep = 0;
  private readonly simulationPercentages = [0.1, 1, 0.5, 0.2];

  constructor(
    private bridgeRatingService: BridgeRatingService,
    private squadService: SquadService,
    @Inject(AppConfig.KEY) private appCfg: AppConfigType,
  ) {}

  // Runs at midnight â€” ensures ratings reflect the latest sweep and CAC data each day
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async recalculateAllRatings() {
    this.logger.log('Running daily Bridge Rating recalculation');

    const businesses = await db
      .select({ id: businessProfiles.id })
      .from(businessProfiles);

    for (const bp of businesses) {
      try {
        await this.bridgeRatingService.recalculate(bp.id, 'scheduled');
      } catch (err) {
        this.logger.error(`Rating recalc failed for ${bp.id}: ${err}`);
      }
    }

    this.logger.log(`Recalculated ratings for ${businesses.length} businesses`);
  }

  // Runs at 1 AM â€” marks listings as defaulted if they haven't repaid within MAX_DEAL_DURATION_MONTHS
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async checkExpiredListings() {
    this.logger.log('Checking for expired listings');

    const maxMonths = this.appCfg.maxDealDurationMonths;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - maxMonths);

    const expired = await db
      .select({ id: listings.id })
      .from(listings)
      .where(
        and(
          or(eq(listings.status, 'funded'), eq(listings.status, 'active')),
          lte(listings.createdAt, cutoff),
        ),
      );

    for (const listing of expired) {
      await db
        .update(listings)
        .set({ status: 'defaulted', updatedAt: new Date() })
        .where(eq(listings.id, listing.id));

      this.logger.warn(
        `Listing ${listing.id} marked defaulted (exceeded ${maxMonths} months)`,
      );
    }
  }

  // Runs at 2 AM â€” refreshes the single-row platformStats aggregate for the public stats endpoint
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async updatePlatformStats() {
    this.logger.log('Updating platform stats');

    const [funded] = await db
      .select({ val: count() })
      .from(listings)
      .where(eq(listings.status, 'completed'));

    const [totalDeployed] = await db
      .select({ val: sum(investments.amountCommitted) })
      .from(investments)
      .where(
        or(
          eq(investments.status, 'active'),
          eq(investments.status, 'completed'),
        ),
      );

    await db
      .update(platformStats)
      .set({
        totalBusinessesFunded: funded.val,
        totalCapitalDeployedKobo: Number(totalDeployed.val ?? 0),
        updatedAt: new Date(),
      })
      .where(eq(platformStats.id, 1)); // always row id=1

    this.logger.log('Platform stats updated');
  }

  // Runs every 30 minutes — simulates revenue for businesses with active listings
  @Cron(CronExpression.EVERY_30_MINUTES)
  async simulatePeriodicRevenue() {
    this.logger.log('Running 30-minute revenue simulation');

    const businessesWithActiveListings = await db
      .select({ 
        userId: businessProfiles.userId,
        monoAverageMonthlyInflow: businessProfiles.monoAverageMonthlyInflow,
        averageMonthlyRevenue: businessProfiles.averageMonthlyRevenue,
        squadVirtualAccountNumber: users.squadVirtualAccountNumber
      })
      .from(listings)
      .innerJoin(businessProfiles, eq(listings.businessId, businessProfiles.id))
      .innerJoin(users, eq(businessProfiles.userId, users.id))
      .where(or(eq(listings.status, 'active'), eq(listings.status, 'funded')));

    const percentage = this.simulationPercentages[this.simulationStep % this.simulationPercentages.length];
    this.simulationStep++;

    for (const b of businessesWithActiveListings) {
      if (!b.squadVirtualAccountNumber) continue;

      const baseline = b.monoAverageMonthlyInflow ?? b.averageMonthlyRevenue ?? 0;
      if (baseline <= 0) continue;
      
      const depositAmount = Math.floor(baseline * (percentage / 100));

      if (depositAmount > 0) {
        try {
          await this.squadService.simulatePayment(b.squadVirtualAccountNumber, depositAmount);
        } catch (e) {
          this.logger.error(`Failed to simulate 30m revenue for ${b.userId}: ${e}`);
        }
      }
    }

    this.logger.log(`Simulated revenue for ${businessesWithActiveListings.length} businesses`);
  }
}
