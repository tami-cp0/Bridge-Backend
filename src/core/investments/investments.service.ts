import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
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
import { eq, and } from 'drizzle-orm';
import { SquadService } from '../squad/squad.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { v4 as uuidv4 } from 'uuid';

const MIN_INVESTMENT_KOBO = 500_000; // ₦5,000 platform minimum for all tiers

const DEFAULT_POOL_RATE = 0.04; // 4% of every investment held as a default protection pool

// GTBank settlement default. Beneficiary accounts collected at signup are
// GTBank NUBANs; this code maps to GTBank for /payout/transfer.
const SETTLEMENT_BANK_CODE = '058';

@Injectable()
export class InvestmentsService {
  private readonly logger = new Logger(InvestmentsService.name);

  constructor(
    private squadService: SquadService,
    private ledgerService: LedgerService,
  ) {}

  async createInvestment(investorUserId: string, dto: CreateInvestmentDto) {
    const [listing] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, dto.listingId));

    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.status !== 'active')
      throw new BadRequestException('Listing is not active');

    const [bp] = await db
      .select({ userId: businessProfiles.userId, businessName: businessProfiles.businessName })
      .from(businessProfiles)
      .where(eq(businessProfiles.id, listing.businessId));

    const minInvestmentKobo = MIN_INVESTMENT_KOBO;
    const minInvestmentNaira = (minInvestmentKobo / 100).toLocaleString();
    if (dto.amountCommitted < minInvestmentKobo) {
      throw new BadRequestException(
        `Minimum investment for this listing is ₦${minInvestmentNaira}`,
      );
    }

    const remaining =
      (listing.capitalRequested ?? 0) - (listing.totalCommitted ?? 0);
    if (dto.amountCommitted > remaining) {
      throw new BadRequestException('Amount exceeds remaining unfunded amount');
    }

    // 4% is held as a default protection pool — it does not reduce the investor's ownership share.
    // Share is based on gross commitment so all shares sum to 100% and sweeps distribute correctly.
    const defaultPoolContribution = Math.floor(
      dto.amountCommitted * DEFAULT_POOL_RATE,
    );
    const sharePercent =
      (dto.amountCommitted / (listing.capitalRequested ?? 1)) * 100;
    const totalReturnDue = Math.round(
      (sharePercent / 100) * (listing.totalReturnAmount ?? 0),
    );

    // Investor must already have the funds in their internal wallet (i.e.
    // deposited into their VA → credited to their ledger).
    const investorBalance =
      await this.ledgerService.getAvailableBalance(investorUserId);
    if (investorBalance < dto.amountCommitted) {
      throw new BadRequestException(
        `Insufficient wallet balance. Available: ₦${(investorBalance / 100).toLocaleString('en-NG')}`,
      );
    }

    const ref = `inv-${uuidv4()}`;

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
        status: 'inactive',
        squadTransferReference: ref,
      })
      .returning();

    // Debit the investor's ledger — their share of the escrow is now locked
    // against this investment.
    await this.ledgerService.debit({
      userId: investorUserId,
      amount: dto.amountCommitted,
      purpose: 'investment_commit',
      referenceId: investment.id,
      referenceType: 'investment',
      squadTransactionReference: ref,
    });

    // Credit the default pool
    const systemUserId = await this.ledgerService.getSystemUserId();
    await this.ledgerService.credit({
      userId: systemUserId,
      amount: defaultPoolContribution,
      purpose: 'default_pool',
      referenceId: investment.id,
      referenceType: 'investment',
      squadTransactionReference: `pool-${uuidv4()}`,
    });

    const oldTotalCommitted = listing.totalCommitted ?? 0;
    const capitalRequested = listing.capitalRequested ?? 0;
    const newTotalCommitted = oldTotalCommitted + dto.amountCommitted;
    const newInvestorCount = (listing.investorCount ?? 0) + 1;

    await db
      .update(listings)
      .set({
        totalCommitted: newTotalCommitted,
        investorCount: newInvestorCount,
        updatedAt: new Date(),
      })
      .where(eq(listings.id, dto.listingId));

    // 50% milestone — only fires when crossing the threshold
    if (
      capitalRequested > 0 &&
      oldTotalCommitted < capitalRequested / 2 &&
      newTotalCommitted >= capitalRequested / 2 &&
      newTotalCommitted < capitalRequested &&
      bp?.userId
    ) {
      await db.insert(notifications).values({
        userId: bp.userId,
        title: 'Listing 50% funded!',
        body: `Your listing has reached 50% of its funding goal (₦${(newTotalCommitted / 100).toLocaleString('en-NG')}).`,
      });
    }

    // If this investment fills the listing, fund it and release tranche 1
    if (newTotalCommitted >= capitalRequested) {
      await this.fundListing(dto.listingId, listing);
    }

    await db.insert(notifications).values({
      userId: investorUserId,
      title: `Successfully committed ₦${(dto.amountCommitted / 100).toLocaleString('en-NG')} into ${bp?.businessName ?? 'the listing'}`,
      body: `Your investment of ₦${(dto.amountCommitted / 100).toLocaleString('en-NG')} has been committed to the listing.`,
    });

    return investment;
  }

  async cancelInvestment(investorUserId: string, investmentId: string) {
    const [investment] = await db
      .select()
      .from(investments)
      .where(eq(investments.id, investmentId));

    if (!investment) throw new NotFoundException('Investment not found');
    if (investment.investorId !== investorUserId) {
      throw new ForbiddenException('You do not own this investment');
    }

    if (investment.status !== 'inactive') {
      throw new BadRequestException(
        'Only inactive investments (listing not yet funded) can be cancelled',
      );
    }

    const [listing] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, investment.listingId));

    if (!listing) throw new NotFoundException('Listing not found');

    await db.transaction(async (tx) => {
      // 1. Refund the investor's committed capital
      await this.ledgerService.credit({
        userId: investorUserId,
        amount: investment.amountCommitted,
        purpose: 'investment_refund',
        referenceId: investmentId,
        referenceType: 'investment',
        squadTransactionReference: `ref-${uuidv4()}`,
      });

      // 2. Reverse the default pool contribution from the system user
      const systemUserId = await this.ledgerService.getSystemUserId();
      await this.ledgerService.debit({
        userId: systemUserId,
        amount: investment.defaultPoolContribution ?? 0,
        purpose: 'default_pool_reversal',
        referenceId: investmentId,
        referenceType: 'investment',
        squadTransactionReference: `rev-${uuidv4()}`,
      });

      // 3. Update the listing's committed total and investor count
      const newCommitted = Math.max(
        0,
        (listing.totalCommitted ?? 0) - investment.amountCommitted,
      );
      const newInvestorCount = Math.max(0, (listing.investorCount ?? 0) - 1);

      await tx
        .update(listings)
        .set({
          totalCommitted: newCommitted,
          investorCount: newInvestorCount,
          updatedAt: new Date(),
        })
        .where(eq(listings.id, listing.id));

      // 4. Delete the investment record
      await tx.delete(investments).where(eq(investments.id, investmentId));
    });

    return { success: true, message: 'Investment cancelled and refunded' };
  }

  async getSweepsForDeal(listingId: string, investorUserId: string) {
    const [investment] = await db
      .select({ id: investments.id })
      .from(investments)
      .where(
        and(
          eq(investments.listingId, listingId),
          eq(investments.investorId, investorUserId),
        ),
      );

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

  private async fundListing(
    listingId: string,
    listing: typeof listings.$inferSelect,
  ) {
    await db.transaction(async (tx) => {
      await tx
        .update(listings)
        .set({ status: 'funded', updatedAt: new Date() })
        .where(eq(listings.id, listingId));

      // Mark all investments as active now that the listing is funded
      await tx
        .update(investments)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(investments.listingId, listingId));
    });

    const [tranche1] = await db
      .select()
      .from(tranches)
      .where(
        and(eq(tranches.listingId, listingId), eq(tranches.trancheNumber, 1)),
      );

    if (!tranche1 || tranche1.status !== 'locked') return;

    const [bp] = await db
      .select({ userId: businessProfiles.userId })
      .from(businessProfiles)
      .where(eq(businessProfiles.id, listing.businessId));

    if (!bp) return;

    const [busUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, bp.userId));

    if (!busUser?.beneficiaryAccount) {
      this.logger.error(
        `Cannot release tranche 1 for listing ${listingId}: business has no beneficiary account`,
      );
      return;
    }

    const trancheRef = `tranche1-${tranche1.id}`;
    let status = 'failed';
    try {
      const result = await this.squadService.initiateTransfer(
        tranche1.amount,
        SETTLEMENT_BANK_CODE,
        busUser.beneficiaryAccount,
        busUser.fullName,
        trancheRef,
        'Tranche 1 release',
      );
      status = result.status;
    } catch (err) {
      this.logger.error(
        `Tranche 1 payout failed for listing ${listingId}: ${String(err)}`,
      );
      return;
    }

    if (status === 'failed' || status === 'reversed') {
      this.logger.error(
        `Tranche 1 payout was not successful (${status}) for listing ${listingId}`,
      );
      return;
    }

    await db
      .update(tranches)
      .set({
        status: 'released',
        releasedAt: new Date(),
        squadTransferReference: trancheRef,
      })
      .where(eq(tranches.id, tranche1.id));

    // Ledger accounting for tranche release
    await this.ledgerService.credit({
      userId: bp.userId,
      amount: tranche1.amount,
      purpose: 'tranche_release',
      referenceId: tranche1.id,
      referenceType: 'tranche',
      squadTransactionReference: `release-${trancheRef}`,
    });

    await this.ledgerService.debit({
      userId: bp.userId,
      amount: tranche1.amount,
      purpose: 'tranche_payout',
      referenceId: tranche1.id,
      referenceType: 'tranche',
      squadTransactionReference: trancheRef,
    });

    await db.insert(notifications).values({
      userId: bp.userId,
      title: `Listing funded! ₦${(tranche1.amount / 100).toLocaleString('en-NG')} Tranche 1 release was successful`,
      body: `Your listing has been fully funded. Tranche 1 (₦${(tranche1.amount / 100).toLocaleString('en-NG')}) has been released to your bank account.`,
    });
  }
}
