import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { db } from '../db';
import {
  businessProfiles,
  users,
  bridgeRatings,
  listings,
  sweepEvents,
  notifications,
} from '../db/schema';
import { eq, and, or, inArray, desc } from 'drizzle-orm';

@Injectable()
export class BusinessService {
  constructor(private config: ConfigService) {}

  async getProfile(userId: string) {
    const [result] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId))
      .leftJoin(users, eq(users.id, businessProfiles.userId))
      .leftJoin(bridgeRatings, eq(bridgeRatings.businessId, businessProfiles.id));

    if (!result) throw new NotFoundException('Business profile not found');
    return result;
  }

  async getStats(userId: string) {
    const [bp] = await db
      .select({ id: businessProfiles.id })
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId));

    if (!bp) throw new NotFoundException('Business profile not found');

    const allListings = await db
      .select({
        capitalRequested: listings.capitalRequested,
        totalSwept: listings.totalSwept,
        status: listings.status,
      })
      .from(listings)
      .where(
        and(
          eq(listings.businessId, bp.id),
          or(eq(listings.status, 'funded'), eq(listings.status, 'completed')),
        ),
      );

    const totalCapitalRaised = allListings.reduce(
      (s, l) => s + (l.capitalRequested ?? 0),
      0,
    );
    const totalSweptToInvestors = allListings.reduce(
      (s, l) => s + (l.totalSwept ?? 0),
      0,
    );
    const completedDealsCount = allListings.filter((l) => l.status === 'completed').length;

    return { totalCapitalRaised, totalSweptToInvestors, completedDealsCount };
  }

  async getActiveListing(userId: string) {
    const [bp] = await db
      .select({ id: businessProfiles.id })
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId));

    if (!bp) throw new NotFoundException('Business profile not found');

    const [listing] = await db
      .select()
      .from(listings)
      .where(
        and(
          eq(listings.businessId, bp.id),
          or(eq(listings.status, 'active'), eq(listings.status, 'funded')),
        ),
      );

    return listing ?? null;
  }

  async getActivity(userId: string) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(5);
  }

  async getPaymentLink(userId: string) {
    const [user] = await db
      .select({ squadVirtualAccountNumber: users.squadVirtualAccountNumber })
      .from(users)
      .where(eq(users.id, userId));

    if (!user?.squadVirtualAccountNumber) {
      throw new NotFoundException('Virtual account not found');
    }

    const virtualAccountNumber = user.squadVirtualAccountNumber;
    const squadBase = this.config.get<string>('SQUAD_BASE_URL') ?? '';
    const payBase = squadBase.includes('sandbox')
      ? 'https://sandbox.squadco.com'
      : 'https://pay.squadco.com';
    const paymentLink = `${payBase}/${virtualAccountNumber}`;
    return { paymentLink, virtualAccountNumber };
  }

  async getPayments(userId: string) {
    const [bp] = await db
      .select({ id: businessProfiles.id })
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId));

    if (!bp) return [];

    const [activeListing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(
        and(
          eq(listings.businessId, bp.id),
          or(eq(listings.status, 'active'), eq(listings.status, 'funded')),
        ),
      );

    if (!activeListing) return [];

    return db
      .select()
      .from(sweepEvents)
      .where(eq(sweepEvents.listingId, activeListing.id))
      .orderBy(desc(sweepEvents.processedAt))
      .limit(10);
  }

  async getSweepSummary(userId: string) {
    const [bp] = await db
      .select({ id: businessProfiles.id })
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId));

    if (!bp) throw new NotFoundException('Business profile not found');

    const [activeListing] = await db
      .select({
        totalSwept: listings.totalSwept,
        totalReturnAmount: listings.totalReturnAmount,
        revenueSharePercent: listings.revenueSharePercent,
      })
      .from(listings)
      .where(
        and(
          eq(listings.businessId, bp.id),
          or(eq(listings.status, 'active'), eq(listings.status, 'funded')),
        ),
      );

    if (!activeListing) return { totalSwept: 0, totalRemaining: 0, currentSweepPercent: 0 };

    return {
      totalSwept: activeListing.totalSwept ?? 0,
      totalRemaining: (activeListing.totalReturnAmount ?? 0) - (activeListing.totalSwept ?? 0),
      currentSweepPercent: activeListing.revenueSharePercent,
    };
  }

}
