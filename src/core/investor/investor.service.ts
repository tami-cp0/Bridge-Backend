import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { db } from '../../db';
import {
  investorProfiles,
  investments,
  notifications,
  users,
  sweepDistributions,
  sweepEvents,
  listings,
  businessProfiles,
} from '../../db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { SquadService } from '../squad/squad.service';
import { LedgerService } from '../ledger/ledger.service';
import { SquadConfig } from '../../config/config';
import type { SquadConfigType } from '../../config/config.types';

@Injectable()
export class InvestorService {
  constructor(
    private squadService: SquadService,
    private ledgerService: LedgerService,
    @Inject(SquadConfig.KEY) private squadCfg: SquadConfigType,
  ) {}

  async getSummary(userId: string) {
    const allInvestments = await db
      .select({
        amountCommitted: investments.amountCommitted,
        totalReturnReceived: investments.totalReturnReceived,
        defaultPoolContribution: investments.defaultPoolContribution,
        status: investments.status,
      })
      .from(investments)
      .where(eq(investments.investorId, userId));

    const totalCapitalDeployed = allInvestments.reduce(
      (s, i) => s + (i.amountCommitted ?? 0),
      0,
    );
    const totalReturnsReceived = allInvestments.reduce(
      (s, i) => s + (i.totalReturnReceived ?? 0),
      0,
    );
    const activeDealsCount = allInvestments.filter(
      (i) => i.status === 'active',
    ).length;
    const defaultPoolContributionBalance = allInvestments.reduce(
      (s, i) => s + (i.defaultPoolContribution ?? 0),
      0,
    );

    return {
      totalCapitalDeployed,
      totalReturnsReceived,
      activeDealsCount,
      defaultPoolContributionBalance,
    };
  }

  async getActivity(userId: string) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(5);
  }

  async getDeals(userId: string, status?: string) {
    const results = await db
      .select({
        id: investments.id,
        listingId: investments.listingId,
        investorId: investments.investorId,
        amountCommitted: investments.amountCommitted,
        defaultPoolContribution: investments.defaultPoolContribution,
        sharePercent: investments.sharePercent,
        totalReturnDue: investments.totalReturnDue,
        totalReturnReceived: investments.totalReturnReceived,
        status: investments.status,
        squadTransferReference: investments.squadTransferReference,
        createdAt: investments.createdAt,
        updatedAt: investments.updatedAt,
        targetRepaymentMonths: listings.targetRepaymentMonths,
        businessName: businessProfiles.businessName,
      })
      .from(investments)
      .innerJoin(listings, eq(listings.id, investments.listingId))
      .innerJoin(businessProfiles, eq(businessProfiles.id, listings.businessId))
      .where(eq(investments.investorId, userId));

    if (!status) return results;
    return results.filter((i) => i.status === status);
  }

  async getWallet(userId: string) {
    // Withdrawable balance is the user's allocation of the merchant wallet.
    const availableBalance =
      await this.ledgerService.getAvailableBalance(userId);

    // Default pool is the sum of 4% contributions across all investments;
    // it is locked against the listing, not the user's spendable balance.
    const allInvestments = await db
      .select({ defaultPoolContribution: investments.defaultPoolContribution })
      .from(investments)
      .where(eq(investments.investorId, userId));

    const defaultPoolBalance = allInvestments.reduce(
      (s, i) => s + (i.defaultPoolContribution ?? 0),
      0,
    );

    return { availableBalance, defaultPoolBalance };
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const updates: Partial<typeof investorProfiles.$inferInsert> = {};
    if (dto.sectorInterests !== undefined)
      updates.sectorInterests = dto.sectorInterests;
    if (dto.riskTierPreference !== undefined)
      updates.riskTierPreference = dto.riskTierPreference;
    if (dto.returnTimelinePreference !== undefined)
      updates.returnTimelinePreference = dto.returnTimelinePreference;
    if (dto.investmentRangeMin !== undefined)
      updates.investmentRangeMin = dto.investmentRangeMin;
    if (dto.investmentRangeMax !== undefined)
      updates.investmentRangeMax = dto.investmentRangeMax;

    await db
      .update(investorProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(investorProfiles.userId, userId));

    const [updated] = await db
      .select()
      .from(investorProfiles)
      .where(eq(investorProfiles.userId, userId));

    return updated;
  }

  async getProfile(userId: string) {
    const [result] = await db
      .select()
      .from(investorProfiles)
      .where(eq(investorProfiles.userId, userId))
      .leftJoin(users, eq(users.id, investorProfiles.userId));

    if (!result) throw new NotFoundException('Investor profile not found');
    return result;
  }

  // Sandbox-only: ask Squad to simulate an incoming payment to the user's VA.
  // Squad responds, then fires the webhook which is what credits the ledger.
  async simulateDeposit(userId: string, amount: number) {
    const [user] = await db
      .select({ squadVirtualAccountNumber: users.squadVirtualAccountNumber })
      .from(users)
      .where(eq(users.id, userId));

    if (!user?.squadVirtualAccountNumber) {
      throw new NotFoundException('Virtual account not found');
    }

    // Squad's simulate API expects Naira (e.g. "1000.00"), but our API receives kobo.
    const amountNaira = (amount / 100).toFixed(2);

    await this.squadService.simulatePayment(
      user.squadVirtualAccountNumber,
      Number(amountNaira),
    );

    return {
      simulated: true,
      amount,
      virtualAccountNumber: user.squadVirtualAccountNumber,
      message:
        'Deposit simulated. The Squad webhook will credit your wallet shortly.',
    };
  }

  async getPaymentLink(userId: string) {
    const [user] = await db
      .select({ squadVirtualAccountNumber: users.squadVirtualAccountNumber })
      .from(users)
      .where(eq(users.id, userId));

    if (!user?.squadVirtualAccountNumber) {
      throw new NotFoundException('Virtual account not found');
    }

    const { squadVirtualAccountNumber } = user;
    const squadBase = this.squadCfg.baseUrl ?? '';
    const payBase = squadBase.includes('sandbox')
      ? 'https://sandbox.squadco.com'
      : 'https://pay.squadco.com';

    return {
      paymentLink: `${payBase}/${squadVirtualAccountNumber}`,
      virtualAccountNumber: squadVirtualAccountNumber,
    };
  }

  async getReturns(
    userId: string,
    period: 'hourly' | 'daily' | 'monthly' | 'yearly',
    year?: number,
    month?: number,
    day?: number,
  ) {
    if (period === 'hourly' && (!year || !month || !day)) {
      throw new BadRequestException(
        'year, month, and day are required for hourly period',
      );
    }
    if (period === 'daily' && (!year || !month)) {
      throw new BadRequestException(
        'year and month are required for daily period',
      );
    }
    if (period === 'monthly' && !year) {
      throw new BadRequestException('year is required for monthly period');
    }

    // Get all investments for this investor
    const allInvestments = await db
      .select({ id: investments.id })
      .from(investments)
      .where(eq(investments.investorId, userId));

    if (!allInvestments.length) return { period, year, month, day, data: [] };

    const investmentIds = allInvestments.map((i) => i.id);

    // Get all distributions joined with sweep events for timestamps
    const distributions = await db
      .select({
        amountDistributed: sweepDistributions.amountDistributed,
        processedAt: sweepEvents.processedAt,
      })
      .from(sweepDistributions)
      .innerJoin(
        sweepEvents,
        eq(sweepEvents.id, sweepDistributions.sweepEventId),
      )
      .where(inArray(sweepDistributions.investmentId, investmentIds));

    // Group into time buckets
    const buckets = new Map<string, number>();

    for (const d of distributions) {
      const date = new Date(d.processedAt);
      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      const dayOfMonth = date.getDate();
      const h = date.getHours();

      if (period === 'hourly' && (y !== year || m !== month || dayOfMonth !== day)) continue;
      if (period === 'daily' && (y !== year || m !== month)) continue;
      if (period === 'monthly' && y !== year) continue;

      const key =
        period === 'hourly'
          ? `${y}-${String(m).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}T${String(h).padStart(2, '0')}:00`
          : period === 'daily'
            ? `${y}-${String(m).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`
            : period === 'monthly'
              ? `${y}-${String(m).padStart(2, '0')}`
              : String(y);

      buckets.set(key, (buckets.get(key) ?? 0) + (d.amountDistributed ?? 0));
    }

    // Sort chronologically and compute cumulative totals
    const sorted = Array.from(buckets.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    let cumulative = 0;
    const data = sorted.map(([label, totalReturnsReceived]) => {
      cumulative += totalReturnsReceived;
      return { label, totalReturnsReceived, cumulativeReturns: cumulative };
    });

    return { period, year: year ?? null, month: month ?? null, day: day ?? null, data };
  }
}
