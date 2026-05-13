import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { db } from '../../db';
import {
  listings,
  businessProfiles,
  bridgeRatings,
  tranches,
  investorProfiles,
  users,
} from '../../db/schema';
import { eq, and, or, gte, lte, asc, desc, SQL } from 'drizzle-orm';
import { AiProfileService } from './ai-profile.service';
import { CreateListingDto } from './dto/create-listing.dto';

// Return rate formula constants
const BASE_RETURN_RATE = 30; // percent â€” platform baseline for all businesses
const MIN_RETURN_RATE = 20;
const MAX_RETURN_RATE = 40;
const HORIZON_BASE_MONTHS = 12; // 12-month deals are the anchor â€” longer horizons earn a premium
const HORIZON_RATE_PER_MONTH = 0.5; // percent added per month beyond the base horizon

// Sweep rate bounds
const SWEEP_RATE_MIN = 5; // floor â€” extend horizon instead of going below this
const SWEEP_RATE_WARN = 15; // block above this; business must request less or extend horizon

type BridgeStanding = 'Seed' | 'Established' | 'Elite';

// Elite standing earns the most reduction; Seed earns none
const STANDING_REDUCTIONS: Record<BridgeStanding, number> = {
  Seed: 0,
  Established: -5,
  Elite: -10,
};

// Per-tier gates: revenue floor, max capital as a multiple of avg monthly revenue,
// and longest allowed timeline
const TIER_CONFIG: Record<
  number,
  {
    // minRevenueKobo: number;
    revenueMultiple: number;
    maxTimelineMonths: number;
  }
> = {
  1: {
    // minRevenueKobo: 30_000_000,
    revenueMultiple: 1.5,
    maxTimelineMonths: 18,
  },
  2: {
    // minRevenueKobo: 200_000_000,
    revenueMultiple: 2.0,
    maxTimelineMonths: 24,
  },
  3: {
    // minRevenueKobo: 1_000_000_000,
    revenueMultiple: 2.0,
    maxTimelineMonths: 24,
  },
};

@Injectable()
export class ListingsService {
  constructor(private aiProfileService: AiProfileService) {}

  async calculateTerms(
    userId: string,
    capitalRequested: number,
    preferredRepaymentMonths: number,
  ) {
    const [bp] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId));

    if (!bp) throw new NotFoundException('Business profile not found');

    const [rating] = await db
      .select()
      .from(bridgeRatings)
      .where(eq(bridgeRatings.businessId, bp.id));

    const tier = bp.tier ?? 1;
    const tierConfig = TIER_CONFIG[tier as 1 | 2 | 3] ?? TIER_CONFIG[1];

    // Prefer verified Mono inflow over self-reported revenue for more accurate terms
    const avgMonthlyInflow =
      bp.monoAverageMonthlyInflow ?? bp.averageMonthlyRevenue;

    // if (avgMonthlyInflow < tierConfig.minRevenueKobo) {
    //   const minRevNaira = (tierConfig.minRevenueKobo / 100).toLocaleString();
    //   throw new BadRequestException(
    //     `Tier ${tier} requires a minimum average monthly revenue of ₦${minRevNaira}`,
    //   );
    // }

    if (preferredRepaymentMonths > tierConfig.maxTimelineMonths) {
      throw new BadRequestException(
        `Tier ${tier} listings have a maximum repayment timeline of ${tierConfig.maxTimelineMonths} months`,
      );
    }

    // Hard ceiling: capital <= revenueMultiple × avgMonthlyInflow
    const maxCapitalByMultiple = Math.floor(
      avgMonthlyInflow * tierConfig.revenueMultiple,
    );
    if (capitalRequested > maxCapitalByMultiple) {
      const maxNaira = (maxCapitalByMultiple / 100).toLocaleString();
      throw new BadRequestException(
        `Tier ${tier} businesses can raise up to ${tierConfig.revenueMultiple}× their average monthly revenue (₦${maxNaira})`,
      );
    }

    // Base rate adjusted down for higher-rated businesses (Established −5%, Elite −10%)
    const standing = rating?.standing ?? 'Seed';
    const ratingReduction = STANDING_REDUCTIONS[standing] ?? 0;
    const ratingAdjustedRate = BASE_RETURN_RATE + ratingReduction;

    // Longer timelines earn a premium: +0.5% per month beyond the 12-month anchor, capped at 40%
    const horizonBump =
      Math.max(0, preferredRepaymentMonths - HORIZON_BASE_MONTHS) *
      HORIZON_RATE_PER_MONTH;
    const totalReturnPercent = Math.min(
      MAX_RETURN_RATE,
      Math.max(MIN_RETURN_RATE, ratingAdjustedRate + horizonBump),
    );

    // Total amount the business must repay = capital × (1 + returnRate)
    const totalReturnAmount = Math.round(
      capitalRequested * (1 + totalReturnPercent / 100),
    );
    // Revenue share needed each month = totalOwed / (months × monthlyRevenue)
    const rawSharePercent =
      (totalReturnAmount / avgMonthlyInflow / preferredRepaymentMonths) * 100;
    const rawRounded = Math.round(rawSharePercent * 10) / 10; // one decimal place

    if (rawRounded > SWEEP_RATE_WARN) {
      // Max capital that fits under the 15% ceiling at this timeline: rearranges the share% formula
      const maxCapitalKobo = Math.floor(
        ((SWEEP_RATE_WARN / 100) *
          avgMonthlyInflow *
          preferredRepaymentMonths) /
          (1 + totalReturnPercent / 100),
      );

      // Find the earliest month at which the requested capital fits under 15%
      // (re-runs the full formula for each candidate month using that month's rate)
      let minMonths: number | null = null;
      for (
        let m = preferredRepaymentMonths + 1;
        m <= tierConfig.maxTimelineMonths;
        m++
      ) {
        const hb =
          Math.max(0, m - HORIZON_BASE_MONTHS) * HORIZON_RATE_PER_MONTH;
        const trp = Math.min(
          MAX_RETURN_RATE,
          Math.max(MIN_RETURN_RATE, ratingAdjustedRate + hb),
        );
        const tra = capitalRequested * (1 + trp / 100); // total owed at this month's rate
        if ((tra / avgMonthlyInflow / m) * 100 <= SWEEP_RATE_WARN) {
          minMonths = m;
          break;
        }
      }

      const capitalNaira = (capitalRequested / 100).toLocaleString();
      const maxCapitalNaira = (maxCapitalKobo / 100).toLocaleString();

      const optionA = `Option A: Request ₦${maxCapitalNaira} or less over ${preferredRepaymentMonths} months`;
      const optionB = minMonths
        ? `\nOption B: Keep ₦${capitalNaira} and extend repayment to ${minMonths} months`
        : '';

      throw new BadRequestException(
        `You have exceeded the maximum revenue share of 15% (${rawRounded.toFixed(
          1,
        )}%). Either go back and:\n${optionA}${optionB}`,
      );
    }

    // Floor at 5% — if the natural rate is lower, lock it at 5% and let the timeline extend
    const revenueSharePercent =
      rawRounded < SWEEP_RATE_MIN ? SWEEP_RATE_MIN : rawRounded;

    // How many months to fully repay at this sweep rate and average revenue
    const targetRepaymentMonths = Math.ceil(
      totalReturnAmount / ((avgMonthlyInflow * revenueSharePercent) / 100),
    );
    // Kobo swept per month assuming revenue stays exactly at average
    const monthlySweepAtAverage = Math.round(
      (avgMonthlyInflow * revenueSharePercent) / 100,
    );

    // Apply the 4% pool deduction
    const totalDisbursed = capitalRequested * 0.96;
    // Capital disbursed in three tranches: 40% on full funding, 30% after 2nd sweep, 30% after 4th sweep
    const tranche1 = Math.round(totalDisbursed * 0.4);
    const tranche2 = Math.round(totalDisbursed * 0.3);
    const tranche3 = totalDisbursed - tranche1 - tranche2; // remainder avoids rounding drift

    return {
      capitalRequested,
      totalDisbursed,
      totalReturnPercent,
      totalReturnAmount,
      revenueSharePercent,
      targetRepaymentMonths,
      monthlySweepAtAverage,
      tranche1,
      tranche2,
      tranche3,
      // Transparent formula breakdown so businesses understand exactly what affected their rate
      returnRateBreakdown: {
        baseRate: BASE_RETURN_RATE,
        standing,
        ratingReduction,
        horizonBump: Math.round(horizonBump * 10) / 10,
        finalRate: totalReturnPercent,
      },
    };
  }

  async createListing(userId: string, dto: CreateListingDto) {
    const [bp] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId));

    if (!bp) throw new NotFoundException('Business profile not found');

    const existingActive = await db
      .select({ id: listings.id })
      .from(listings)
      .where(
        and(
          eq(listings.businessId, bp.id),
          or(eq(listings.status, 'active'), eq(listings.status, 'funded')),
        ),
      );

    if (existingActive.length > 0) {
      throw new ConflictException('A listing is already active or funded');
    }

    const terms = await this.calculateTerms(
      userId,
      dto.capitalRequested,
      dto.preferredRepaymentMonths,
    );

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    // Generate the AI narrative using OpenAI” this is what investors read
    const aiProfile = await this.aiProfileService.generateProfile({
      businessName: bp.businessName,
      sector: bp.sector,
      location: bp.location,
      yearsInOperation: bp.yearsInOperation,
      selfReportedMonthlyRevenueNaira: bp.averageMonthlyRevenue,
      monoVerifiedMonthlyInflowNaira:
        bp.monoAverageMonthlyInflow ?? bp.averageMonthlyRevenue,
      monoHistoryStartDate: bp.monoHistoryStartDate,
      bvnVerified: user?.bvnVerified ?? false,
      monoLinked: bp.monoLinked ?? false,
      cacVerified: bp.cacVerified ?? false,
      cacRegistrationNumber: bp.cacRegistrationNumber,
      customerConfirmationCount: 0,
      capitalRequestedNaira: dto.capitalRequested,
      useOfFunds: dto.useOfFunds,
      expectedImpact: dto.expectedImpact,
      revenueSharePercent: terms.revenueSharePercent,
      totalReturnPercent: terms.totalReturnPercent,
      totalReturnAmountNaira: terms.totalReturnAmount,
      targetRepaymentMonths: terms.targetRepaymentMonths,
    });

    const [listing] = await db
      .insert(listings)
      .values({
        businessId: bp.id,
        capitalRequested: dto.capitalRequested,
        useOfFunds: dto.useOfFunds,
        expectedImpact: dto.expectedImpact,
        revenueSharePercent: String(terms.revenueSharePercent),
        totalReturnAmount: terms.totalReturnAmount,
        totalReturnPercent: String(terms.totalReturnPercent),
        targetRepaymentMonths: terms.targetRepaymentMonths,
        aiProfile,
        status: 'active',
      })
      .returning();

    await db.insert(tranches).values([
      {
        listingId: listing.id,
        trancheNumber: 1,
        amount: terms.tranche1,
        releaseCondition: 'Listing reaches full funding',
        status: 'locked',
      },
      {
        listingId: listing.id,
        trancheNumber: 2,
        amount: terms.tranche2,
        releaseCondition: 'Second sweep event confirmed on this listing',
        status: 'locked',
      },
      {
        listingId: listing.id,
        trancheNumber: 3,
        amount: terms.tranche3,
        releaseCondition: 'Fourth sweep event confirmed on this listing',
        status: 'locked',
      },
    ]);

    return listing;
  }

  async getListings(filters: {
    sector?: string;
    tier?: number;
    standing?: string;
    minReturn?: number;
    maxReturn?: number;
    minCapital?: number;
    maxCapital?: number;
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(listings.status, 'active')];

    if (filters.sector)
      conditions.push(eq(businessProfiles.sector, filters.sector));
    if (filters.tier !== undefined)
      conditions.push(eq(businessProfiles.tier, filters.tier));
    if (
      filters.standing === 'Seed' ||
      filters.standing === 'Established' ||
      filters.standing === 'Elite'
    ) {
      conditions.push(eq(bridgeRatings.standing, filters.standing));
    }
    if (filters.minReturn !== undefined)
      conditions.push(
        gte(listings.totalReturnPercent, String(filters.minReturn)),
      );
    if (filters.maxReturn !== undefined)
      conditions.push(
        lte(listings.totalReturnPercent, String(filters.maxReturn)),
      );
    if (filters.minCapital !== undefined)
      conditions.push(gte(listings.capitalRequested, filters.minCapital));
    if (filters.maxCapital !== undefined)
      conditions.push(lte(listings.capitalRequested, filters.maxCapital));

    const orderBy =
      (
        {
          highest_return: desc(listings.totalReturnPercent),
          fastest_repayment: asc(listings.targetRepaymentMonths),
          newest: desc(listings.createdAt),
          highest_bridge_rating: desc(bridgeRatings.overallScore),
        } as Record<string, SQL>
      )[filters.sort ?? ''] ?? desc(listings.createdAt);

    return db
      .select()
      .from(listings)
      .leftJoin(businessProfiles, eq(businessProfiles.id, listings.businessId))
      .leftJoin(
        bridgeRatings,
        eq(bridgeRatings.businessId, businessProfiles.id),
      )
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);
  }

  async getMatchedListings(userId: string) {
    const [profile] = await db
      .select()
      .from(investorProfiles)
      .where(eq(investorProfiles.userId, userId));

    const activeListings = await db
      .select()
      .from(listings)
      .leftJoin(businessProfiles, eq(businessProfiles.id, listings.businessId))
      .leftJoin(
        bridgeRatings,
        eq(bridgeRatings.businessId, businessProfiles.id),
      )
      .where(eq(listings.status, 'active'));

    // If the investor hasn't set preferences, return all listings unscored
    if (!profile?.sectorInterests && !profile?.riskTierPreference) {
      return { listings: activeListings, preferencesSet: false };
    }

    // Score each listing against the investor's preferences (max 100 points)
    const scored = activeListings.map((l) => {
      let score = 0;
      const bp = l.business_profiles;

      if (profile.sectorInterests?.includes(bp?.sector ?? '')) score += 30;

      // Map risk label to the tiers it covers
      const tierMapping: Record<string, number[]> = {
        conservative: [1],
        balanced: [1, 2],
        growth: [2, 3],
      };
      if (
        profile.riskTierPreference &&
        tierMapping[profile.riskTierPreference]?.includes(bp?.tier ?? 1)
      )
        score += 25;

      const months = l.listings.targetRepaymentMonths ?? 12;
      const timelineMatch: Record<string, boolean> = {
        short: months <= 15,
        medium: months <= 21,
        flexible: true,
      };
      if (
        profile.returnTimelinePreference &&
        timelineMatch[profile.returnTimelinePreference]
      )
        score += 25;

      const cap = l.listings.capitalRequested ?? 0;
      if (
        profile.investmentRangeMin !== null &&
        profile.investmentRangeMax !== null &&
        cap >= (profile.investmentRangeMin ?? 0) &&
        cap <= (profile.investmentRangeMax ?? Infinity)
      )
        score += 20;

      return { ...l, matchScore: score };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore);
    return { listings: scored, preferencesSet: true };
  }

  async getListingById(id: string) {
    const [result] = await db
      .select()
      .from(listings)
      .leftJoin(businessProfiles, eq(businessProfiles.id, listings.businessId))
      .leftJoin(
        bridgeRatings,
        eq(bridgeRatings.businessId, businessProfiles.id),
      )
      .where(eq(listings.id, id));

    if (!result) throw new NotFoundException('Listing not found');

    const [listingTranches, busUser] = await Promise.all([
      db.select().from(tranches).where(eq(tranches.listingId, id)),
      result.business_profiles?.userId
        ? db
            .select({
              squadVirtualAccountNumber: users.squadVirtualAccountNumber,
            })
            .from(users)
            .where(eq(users.id, result.business_profiles.userId))
            .then(([u]) => u ?? null)
        : Promise.resolve(null),
    ]);

    return {
      ...result,
      tranches: listingTranches,
      businessSquadVirtualAccountNumber:
        busUser?.squadVirtualAccountNumber ?? null,
    };
  }
}
