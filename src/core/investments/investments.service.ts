import {
  Injectable,
  NotFoundException,
  BadRequestException,
  BadGatewayException,
} from '@nestjs/common';
import { db } from '../../db';
import {
  listings,
  investments,
  tranches,
  users,
  businessProfiles,
  notifications,
  sweepEvents,
  sweepDistributions,
} from '../../db/schema';
import { eq, and, or } from 'drizzle-orm';
import { SquadService } from '../squad/squad.service';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { v4 as uuidv4 } from 'uuid';

const TIER_MIN_INVESTMENT_KOBO: Record<number, number> = {
  1: 500_000,     // â‚¦5,000
  2: 2_500_000,   // â‚¦25,000
  3: 10_000_000,  // â‚¦100,000
};

const DEFAULT_POOL_RATE = 0.04;        // 4% of every investment held as a default protection pool
// Central Squad account that holds capital between investment and disbursement
const PLATFORM_ESCROW_ACCOUNT = process.env.SQUAD_ESCROW_ACCOUNT ?? 'ESCROW_ACCOUNT';

@Injectable()
export class InvestmentsService {
  constructor(private squadService: SquadService) {}

  async createInvestment(investorUserId: string, dto: CreateInvestmentDto) {
    const [listing] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, dto.listingId));

    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.status !== 'active') throw new BadRequestException('Listing is not active');

    const [bp] = await db
      .select({ tier: businessProfiles.tier })
      .from(businessProfiles)
      .where(eq(businessProfiles.id, listing.businessId));

    const minInvestmentKobo = TIER_MIN_INVESTMENT_KOBO[bp?.tier ?? 1] ?? TIER_MIN_INVESTMENT_KOBO[1];
    const minInvestmentNaira = (minInvestmentKobo / 100).toLocaleString();
    if (dto.amountCommitted < minInvestmentKobo) {
      throw new BadRequestException(`Minimum investment for this listing is â‚¦${minInvestmentNaira}`);
    }

    const remaining = (listing.capitalRequested ?? 0) - (listing.totalCommitted ?? 0);
    if (dto.amountCommitted > remaining) {
      throw new BadRequestException('Amount exceeds remaining unfunded amount');
    }

    // 4% is held as a default protection pool â€” it does not reduce the investor's ownership share.
    // Share is based on gross commitment so all shares sum to 100% and sweeps distribute correctly.
    const defaultPoolContribution = Math.floor(dto.amountCommitted * DEFAULT_POOL_RATE);
    const sharePercent = (dto.amountCommitted / (listing.capitalRequested ?? 1)) * 100;
    const totalReturnDue = Math.round(
      (sharePercent / 100) * (listing.totalReturnAmount ?? 0),
    );

    const [investorUser] = await db
      .select({ squadVirtualAccountNumber: users.squadVirtualAccountNumber })
      .from(users)
      .where(eq(users.id, investorUserId));

    if (!investorUser?.squadVirtualAccountNumber) {
      throw new BadRequestException('Investor virtual account not found');
    }

    const ref = `inv-${uuidv4()}`;
    try {
      await this.squadService.transferBetweenVirtualAccounts(
        investorUser.squadVirtualAccountNumber,
        PLATFORM_ESCROW_ACCOUNT,
        dto.amountCommitted,
        ref,
      );
    } catch {
      throw new BadGatewayException('Squad transfer failed');
    }

    const [investment] = await db
      .insert(investments)
      .values({
        listingId: dto.listingId,
        investorId: investorUserId,
        amountCommitted: dto.amountCommitted,
        defaultPoolContribution,
        sharePercent: String(sharePercent.toFixed(4)),
        totalReturnDue,
        totalReturnReceived: 0,
        status: 'active',
        squadTransferReference: ref,
      })
      .returning();

    const newTotalCommitted = (listing.totalCommitted ?? 0) + dto.amountCommitted;
    const newInvestorCount = (listing.investorCount ?? 0) + 1;

    await db
      .update(listings)
      .set({
        totalCommitted: newTotalCommitted,
        investorCount: newInvestorCount,
        updatedAt: new Date(),
      })
      .where(eq(listings.id, dto.listingId));

    // If this investment fills the listing, transition it to 'funded' and release tranche 1
    if (newTotalCommitted >= (listing.capitalRequested ?? 0)) {
      await this.fundListing(dto.listingId, listing);
    }

    await db.insert(notifications).values({
      userId: investorUserId,
      title: 'Investment confirmed',
      body: `Your investment of â‚¦${dto.amountCommitted / 100} has been committed to the listing.`,
    });

    return investment;
  }

  async getSweepsForDeal(listingId: string, investorUserId: string) {
    const [investment] = await db
      .select({ id: investments.id })
      .from(investments)
      .where(and(eq(investments.listingId, listingId), eq(investments.investorId, investorUserId)));

    const events = await db
      .select()
      .from(sweepEvents)
      .where(eq(sweepEvents.listingId, listingId))
      .orderBy(sweepEvents.processedAt);

    if (!investment) return events;

    const dists = await db
      .select()
      .from(sweepDistributions)
      .where(eq(sweepDistributions.investmentId, investment.id));

    return events.map((e) => ({
      ...e,
      distribution: dists.find((d) => d.sweepEventId === e.id) ?? null,
    }));
  }

  private async fundListing(listingId: string, listing: typeof listings.$inferSelect) {
    await db
      .update(listings)
      .set({ status: 'funded', updatedAt: new Date() })
      .where(eq(listings.id, listingId));

    const [tranche1] = await db
      .select()
      .from(tranches)
      .where(and(eq(tranches.listingId, listingId), eq(tranches.trancheNumber, 1)));

    if (tranche1 && tranche1.status === 'locked') {
      const [bp] = await db
        .select({ userId: businessProfiles.userId })
        .from(businessProfiles)
        .where(eq(businessProfiles.id, listing.businessId));

      const [busUser] = await db
        .select({ squadVirtualAccountNumber: users.squadVirtualAccountNumber })
        .from(users)
        .where(eq(users.id, bp!.userId));

      const trancheRef = `tranche1-${uuidv4()}`;
      try {
        await this.squadService.transferBetweenVirtualAccounts(
          PLATFORM_ESCROW_ACCOUNT,
          busUser!.squadVirtualAccountNumber!,
          tranche1.amount,
          trancheRef,
        );
      } catch {}

      await db
        .update(tranches)
        .set({ status: 'released', releasedAt: new Date(), squadTransferReference: trancheRef })
        .where(eq(tranches.id, tranche1.id));

      await db.insert(notifications).values({
        userId: bp!.userId,
        title: 'Listing funded!',
        body: `Your listing has been fully funded. Tranche 1 (â‚¦${tranche1.amount / 100}) has been released to your account.`,
      });
    }
  }
}
