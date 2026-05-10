import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../db';
import {
  businessProfiles,
  bridgeRatings,
  listings,
  sweepEvents,
  ratingEvents,
  notifications,
  investments,
  users,
} from '../../db/schema';
import { eq, and, or, gte, desc } from 'drizzle-orm';

type BridgeStanding = 'Seed' | 'Established' | 'Elite';

// Maps a 0â€“100 numeric score to the three Bridge standing labels
function scoreToStanding(score: number): BridgeStanding {
  if (score < 50) return 'Seed';
  if (score < 80) return 'Established';
  return 'Elite';
}

@Injectable()
export class BridgeRatingService {
  private readonly logger = new Logger(BridgeRatingService.name);

  async recalculate(
    businessId: string,
    triggerType = 'manual',
    triggerId?: string,
  ) {
    const [bp] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.id, businessId));

    if (!bp) return;

    const [currentRating] = await db
      .select()
      .from(bridgeRatings)
      .where(eq(bridgeRatings.businessId, businessId));

    const allListings = await db
      .select()
      .from(listings)
      .where(
        and(
          eq(listings.businessId, businessId),
          or(eq(listings.status, 'funded'), eq(listings.status, 'completed')),
        ),
      );

    // Drizzle doesn't support empty OR arrays, so fall back to a never-matching condition
    const allSweepEvents = await db
      .select()
      .from(sweepEvents)
      .where(
        allListings.length > 0
          ? or(...allListings.map((l) => eq(sweepEvents.listingId, l.id)))
          : eq(sweepEvents.id, 'none'),
      );

    const repaymentSpeedScore = this.calcRepaymentSpeed(
      allListings,
      allSweepEvents,
    );
    const repaymentConsistencyScore =
      this.calcRepaymentConsistency(allSweepEvents);
    const transactionVolumeScore = this.calcTransactionVolume(
      bp,
      allSweepEvents,
    );
    const revenueConsistencyScore = this.calcRevenueConsistency(allSweepEvents);
    const cacBonusScore = bp.cacVerified ? 5 : 0;
    const communicationScore = this.calcCommunication(allSweepEvents);

    const overallScore = Math.min(
      100,
      repaymentSpeedScore +
        repaymentConsistencyScore +
        transactionVolumeScore +
        revenueConsistencyScore +
        cacBonusScore +
        communicationScore,
    );

    const newStanding = scoreToStanding(overallScore);
    const previousScore = Number(currentRating?.overallScore ?? 0);
    const previousStanding = (currentRating?.standing ??
      'Seed') as BridgeStanding;

    await db
      .update(bridgeRatings)
      .set({
        overallScore: String(overallScore.toFixed(2)),
        standing: newStanding,
        repaymentSpeedScore: String(repaymentSpeedScore.toFixed(2)),
        repaymentConsistencyScore: String(repaymentConsistencyScore.toFixed(2)),
        transactionVolumeScore: String(transactionVolumeScore.toFixed(2)),
        revenueConsistencyScore: String(revenueConsistencyScore.toFixed(2)),
        cacBonusScore: String(cacBonusScore),
        communicationScore: String(communicationScore.toFixed(2)),
        lastCalculatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bridgeRatings.businessId, businessId));

    await db.insert(ratingEvents).values({
      businessId,
      previousScore: String(previousScore),
      newScore: String(overallScore.toFixed(2)),
      previousStanding,
      newStanding,
      triggerType,
      triggerId: triggerId ?? null,
      inputSnapshot: {
        repaymentSpeedScore,
        repaymentConsistencyScore,
        transactionVolumeScore,
        revenueConsistencyScore,
        cacBonusScore,
        communicationScore,
        sweepEventCount: allSweepEvents.length,
        listingCount: allListings.length,
      },
    });

    if (newStanding !== previousStanding) {
      const [user] = await db
        .select({ userId: businessProfiles.userId })
        .from(businessProfiles)
        .where(eq(businessProfiles.id, businessId));

      if (user) {
        await db.insert(notifications).values({
          userId: user.userId,
          title: 'Bridge Rating updated',
          body: `Your Bridge Rating changed to ${newStanding} (score: ${overallScore.toFixed(0)}/100).`,
        });
      }

      if (newStanding === 'Established' && bp.tier === 1) {
        await db
          .update(businessProfiles)
          .set({ tier: 2, updatedAt: new Date() })
          .where(eq(businessProfiles.id, businessId));
      } else if (newStanding === 'Elite' && bp.tier === 2) {
        await db
          .update(businessProfiles)
          .set({ tier: 3, updatedAt: new Date() })
          .where(eq(businessProfiles.id, businessId));
      }
    }

    // Alert all active investors if a rating drops more than 15 points (potential repayment risk)
    if (previousScore - overallScore > 15) {
      const activeInvestments = await db
        .select({ investorId: investments.investorId })
        .from(investments)
        .where(
          and(
            investments.listingId
              ? or(...allListings.map((l) => eq(investments.listingId, l.id)))
              : eq(investments.id, 'none'),
            eq(investments.status, 'active'),
          ),
        );

      for (const inv of activeInvestments) {
        await db.insert(notifications).values({
          userId: inv.investorId,
          title: 'Early warning',
          body: `A business you invested in has had a significant rating drop. Review your portfolio.`,
        });
      }
    }

    return { overallScore, standing: newStanding };
  }

  async getRating(businessId: string) {
    const [rating] = await db
      .select()
      .from(bridgeRatings)
      .where(eq(bridgeRatings.businessId, businessId));
    return rating;
  }

  // Max 30 pts â€” compares actual swept amount to what was expected by this point in time
  private calcRepaymentSpeed(
    allListings: (typeof listings.$inferSelect)[],
    allSweepEvents: (typeof sweepEvents.$inferSelect)[],
  ): number {
    if (!allListings.length) return 0;

    let totalRatio = 0;
    let count = 0;

    for (const listing of allListings) {
      const listingEvents = allSweepEvents.filter(
        (e) => e.listingId === listing.id,
      );
      const totalSwept = listingEvents.reduce(
        (s, e) => s + (e.sweepAmount ?? 0),
        0,
      );
      const fundedAt = listing.createdAt
        ? new Date(listing.createdAt)
        : new Date();
      const monthsElapsed =
        (Date.now() - fundedAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
      const expectedSweep =
        ((listing.totalReturnAmount ?? 0) /
          (listing.targetRepaymentMonths ?? 1)) *
        monthsElapsed;

      if (expectedSweep <= 0) continue;

      // Cap at 1.5 so early payers aren't penalised relative to the maximum score
      const ratio = Math.min(totalSwept / expectedSweep, 1.5);
      totalRatio += ratio;
      count++;
    }

    if (!count) return 0;
    return (totalRatio / count / 1.5) * 30;
  }

  // Max 25 pts â€” deducts 3 pts for each payment gap longer than 14 days
  private calcRepaymentConsistency(
    events: (typeof sweepEvents.$inferSelect)[],
  ): number {
    let score = 25;
    const sorted = [...events].sort(
      (a, b) =>
        new Date(a.processedAt!).getTime() - new Date(b.processedAt!).getTime(),
    );

    for (let i = 1; i < sorted.length; i++) {
      const gap =
        (new Date(sorted[i].processedAt!).getTime() -
          new Date(sorted[i - 1].processedAt!).getTime()) /
        (1000 * 60 * 60 * 24);
      if (gap > 14) score -= 3;
    }

    return Math.max(0, score);
  }

  // Max 20 pts â€” compares last 30 days' incoming payments to the business's Mono baseline
  private calcTransactionVolume(
    bp: typeof businessProfiles.$inferSelect,
    events: (typeof sweepEvents.$inferSelect)[],
  ): number {
    const baseline =
      bp.monoAverageMonthlyInflow ?? bp.averageMonthlyRevenue ?? 1;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recent = events.filter(
      (e) => e.processedAt && new Date(e.processedAt) >= thirtyDaysAgo,
    );
    const monthlyVolume = recent.reduce(
      (s, e) => s + (e.incomingPaymentAmount ?? 0),
      0,
    );

    const ratio = Math.min(monthlyVolume / baseline, 1);
    return ratio * 20;
  }

  // Max 15 pts â€” uses coefficient of variation across weekly buckets over the last 60 days
  private calcRevenueConsistency(
    events: (typeof sweepEvents.$inferSelect)[],
  ): number {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const recent = events.filter(
      (e) => e.processedAt && new Date(e.processedAt) >= sixtyDaysAgo,
    );

    if (recent.length < 2) return 7.5;

    const weeklyMap = new Map<string, number>();
    for (const e of recent) {
      const d = new Date(e.processedAt!);
      const weekKey = `${d.getFullYear()}-W${Math.ceil(d.getDate() / 7)}`;
      weeklyMap.set(
        weekKey,
        (weeklyMap.get(weekKey) ?? 0) + (e.incomingPaymentAmount ?? 0),
      );
    }

    const values = [...weeklyMap.values()];
    if (values.length < 2) return 15;

    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance =
      values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    // High coefficient of variation = inconsistent revenue = lower score
    const cv = mean > 0 ? stdDev / mean : 1;

    return Math.max(0, 15 - cv * 15);
  }

  // Max 5 pts â€” penalises long gaps between payments (same logic as consistency but smaller weight)
  private calcCommunication(
    events: (typeof sweepEvents.$inferSelect)[],
  ): number {
    let score = 5;
    const sorted = [...events].sort(
      (a, b) =>
        new Date(a.processedAt!).getTime() - new Date(b.processedAt!).getTime(),
    );

    for (let i = 1; i < sorted.length; i++) {
      const gap =
        (new Date(sorted[i].processedAt!).getTime() -
          new Date(sorted[i - 1].processedAt!).getTime()) /
        (1000 * 60 * 60 * 24);
      if (gap > 14) score -= 2;
    }

    return Math.max(0, Math.min(5, score));
  }
}
