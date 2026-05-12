import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { SquadConfig } from '../../config/config';
import type { SquadConfigType } from '../../config/config.types';
import { MonoService } from '../mono/mono.service';
import { db } from '../../db';
import {
  businessProfiles,
  users,
  bridgeRatings,
  listings,
  sweepEvents,
  notifications,
} from '../../db/schema';
import { eq, and, or, inArray, desc, ne } from 'drizzle-orm';

@Injectable()
export class BusinessService {
  constructor(
    @Inject(SquadConfig.KEY) private squadCfg: SquadConfigType,
    private monoService: MonoService,
  ) {}

  async getProfile(userId: string) {
    const [result] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId))
      .leftJoin(users, eq(users.id, businessProfiles.userId))
      .leftJoin(
        bridgeRatings,
        eq(bridgeRatings.businessId, businessProfiles.id),
      );

    if (!result) throw new NotFoundException('Business profile not found');
    return result;
  }

  async connectBank(userId: string, code: string) {
    const [bp] = await db
      .select({
        id: businessProfiles.id,
        bankConnected: businessProfiles.bankConnected,
      })
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId));

    if (!bp) throw new NotFoundException('Business profile not found');
    if (bp.bankConnected)
      throw new ConflictException('Bank account already connected');

    const accountId = await this.monoService.exchangeCode(code);

    await db
      .update(businessProfiles)
      .set({
        bankConnected: true,
        monoAccountId: accountId,
        monoLinked: true,
        updatedAt: new Date(),
      })
      .where(eq(businessProfiles.userId, userId));

    // Trigger income analysis — Mono processes income async and delivers the result
    // via the mono.events.account_income webhook which updates monoAverageMonthlyInflow
    await this.monoService.triggerIncomeProcessing(accountId);

    return { connected: true, averageMonthlyInflow: null };
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
    const completedDealsCount = allListings.filter(
      (l) => l.status === 'completed',
    ).length;

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
    const squadBase = this.squadCfg.baseUrl ?? '';
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

  async getRevenue(
    userId: string,
    period: 'daily' | 'monthly' | 'yearly',
    year?: number,
    month?: number,
  ) {
    const [bp] = await db
      .select({ id: businessProfiles.id })
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId));

    if (!bp) throw new NotFoundException('Business profile not found');

    if (period === 'daily' && (!year || !month)) {
      throw new BadRequestException(
        'year and month are required for daily period',
      );
    }
    if (period === 'monthly' && !year) {
      throw new BadRequestException('year is required for monthly period');
    }

    const allListings = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.businessId, bp.id));

    if (!allListings.length) return { period, data: [] };

    const listingIds = allListings.map((l) => l.id);

    const events = await db
      .select({
        incomingPaymentAmount: sweepEvents.incomingPaymentAmount,
        sweepAmount: sweepEvents.sweepAmount,
        netAmountRetained: sweepEvents.netAmountRetained,
        processedAt: sweepEvents.processedAt,
      })
      .from(sweepEvents)
      .where(
        and(
          inArray(sweepEvents.listingId, listingIds),
          ne(sweepEvents.isManualRepayment, true),
        ),
      );

    // Group events into time buckets using local ISO strings
    const buckets = new Map<
      string,
      { totalIncoming: number; totalSwept: number; totalRetained: number }
    >();

    for (const e of events) {
      const d = new Date(e.processedAt);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const day = d.getDate();

      if (period === 'daily' && (y !== year || m !== month)) continue;
      if (period === 'monthly' && y !== year) continue;

      const key =
        period === 'daily'
          ? `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          : period === 'monthly'
            ? `${y}-${String(m).padStart(2, '0')}`
            : String(y);

      const existing = buckets.get(key) ?? {
        totalIncoming: 0,
        totalSwept: 0,
        totalRetained: 0,
      };
      existing.totalIncoming += e.incomingPaymentAmount ?? 0;
      existing.totalSwept += e.sweepAmount ?? 0;
      existing.totalRetained += e.netAmountRetained ?? 0;
      buckets.set(key, existing);
    }

    const data = Array.from(buckets.entries())
      .map(([label, totals]) => ({ label, ...totals }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return { period, year, month, data };
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

    if (!activeListing)
      return { totalSwept: 0, totalRemaining: 0, currentSweepPercent: 0 };

    return {
      totalSwept: activeListing.totalSwept ?? 0,
      totalRemaining:
        (activeListing.totalReturnAmount ?? 0) -
        (activeListing.totalSwept ?? 0),
      currentSweepPercent: activeListing.revenueSharePercent,
    };
  }
}
