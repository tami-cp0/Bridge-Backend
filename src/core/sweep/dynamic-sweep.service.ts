import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { db } from '../../db';
import { sweepEvents, listings } from '../../db/schema';
import { eq, and, gte } from 'drizzle-orm';

@Injectable()
export class DynamicSweepService {
  constructor(private config: ConfigService) {}

  // Adjusts the sweep % up or down based on how the current payment compares to the 30-day average
  async calculateSweep(
    listingId: string,
    incomingPaymentAmount: number,
  ): Promise<{ sweepAmount: number; sweepPercent: number }> {
    const [listing] = await db
      .select({ revenueSharePercent: listings.revenueSharePercent })
      .from(listings)
      .where(eq(listings.id, listingId));

    const baseRate = Number(listing?.revenueSharePercent ?? 8);
    const tolerance = Number(
      this.config.get<string>('SWEEP_TOLERANCE_PERCENT') ?? 2,
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Look at recent payments to establish a baseline average
    const recentEvents = await db
      .select({ incomingPaymentAmount: sweepEvents.incomingPaymentAmount })
      .from(sweepEvents)
      .where(
        and(
          eq(sweepEvents.listingId, listingId),
          gte(sweepEvents.processedAt, thirtyDaysAgo),
        ),
      );

    let sweepPercent = baseRate;

    if (recentEvents.length > 0) {
      const avg =
        recentEvents.reduce((s, e) => s + (e.incomingPaymentAmount ?? 0), 0) /
        recentEvents.length;

      // Good month (>20% above avg): sweep more; bad month (>20% below avg): sweep less
      if (incomingPaymentAmount > avg * 1.2) {
        sweepPercent = baseRate + tolerance;
      } else if (incomingPaymentAmount < avg * 0.8) {
        sweepPercent = baseRate - tolerance;
      }
    }

    const sweepAmount = Math.round(
      (incomingPaymentAmount * sweepPercent) / 100,
    );
    return { sweepAmount, sweepPercent };
  }
}
