import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { db } from '../../db';
import {
  users,
  businessProfiles,
  listings,
  investments,
  sweepEvents,
  sweepDistributions,
  tranches,
  notifications,
} from '../../db/schema';
import { eq, and, or, count } from 'drizzle-orm';
import { SquadService } from '../squad/squad.service';
import { LedgerService } from '../ledger/ledger.service';
import { DynamicSweepService } from './dynamic-sweep.service';
import { BridgeRatingService } from '../bridge-rating/bridge-rating.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SweepService {
  private readonly logger = new Logger(SweepService.name);

  constructor(
    private squadService: SquadService,
    private dynamicSweepService: DynamicSweepService,
    private bridgeRatingService: BridgeRatingService,
    private ledgerService: LedgerService,
  ) {}

  // Entry point from the webhook controller. Squad fires this when any VA we
  // own receives a payment (real or simulated). Funds land in the merchant
  // wallet; we record an internal credit for whoever owns the VA.
  async handleSquadWebhook(payload: Record<string, unknown>) {
    const eventType = (payload.Event ?? payload.event) as string | undefined;
    const channel = payload.channel as string | undefined;
    this.logger.log(
      `Squad webhook received — Event: ${eventType}, channel: ${channel}`,
    );

    const isPayment =
      channel === 'virtual-account' ||
      !!payload.virtual_account_number ||
      eventType === 'charge_successful';

    if (isPayment) {
      await this.handlePaymentSuccessful(payload);
    }
  }

  private async handlePaymentSuccessful(payload: Record<string, unknown>) {
    const data = (payload.data ?? payload) as Record<string, unknown>;
    const virtualAccountNumber = data.virtual_account_number as string;
    const transactionRef = (data.transaction_reference ??
      data.TransactionRef ??
      data.reference) as string;
    // VA webhooks send principal_amount (in kobo); other payment channels use amount
    const amount = Number(data.principal_amount ?? data.amount ?? 0);

    if (!virtualAccountNumber || !transactionRef) {
      this.logger.warn(
        'Missing virtual_account_number or transaction_reference in webhook',
      );
      return;
    }

    // Idempotency — if this Squad ref already produced a ledger entry, skip.
    if (await this.ledgerService.hasEntryForSquadReference(transactionRef)) {
      this.logger.log(`Duplicate webhook ignored: ${transactionRef}`);
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.squadVirtualAccountNumber, virtualAccountNumber));

    if (!user) {
      this.logger.warn(
        `Webhook for unknown VA ${virtualAccountNumber} — ignoring`,
      );
      return;
    }

    if (amount <= 0) return;

    // Always credit the recipient for the incoming money. This is what makes
    // the merchant wallet's escrow allocable per user.
    await this.ledgerService.credit({
      userId: user.id,
      amount,
      purpose: 'deposit',
      squadTransactionReference: transactionRef,
    });

    await db.insert(notifications).values({
      userId: user.id,
      title: 'Deposit received',
      body: `₦${(amount / 100).toLocaleString('en-NG')} was credited to your wallet.`,
    });

    // For businesses with an active listing, the deposit also triggers a sweep.
    if (user.userType === 'business') {
      await this.processBusinessSweep(user.id, amount, transactionRef);
    }
  }

  private async processBusinessSweep(
    businessUserId: string,
    incomingAmount: number,
    transactionRef: string,
  ) {
    const [bp] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, businessUserId));

    if (!bp) return;

    const [activeListing] = await db
      .select()
      .from(listings)
      .where(
        and(
          eq(listings.businessId, bp.id),
          or(eq(listings.status, 'active'), eq(listings.status, 'funded')),
        ),
      );

    if (!activeListing) return;

    const { sweepAmount: rawSweep, sweepPercent } =
      await this.dynamicSweepService.calculateSweep(
        activeListing.id,
        incomingAmount,
      );

    const totalSwept = activeListing.totalSwept ?? 0;
    const totalReturnAmount = activeListing.totalReturnAmount ?? 0;
    const remaining = totalReturnAmount - totalSwept;
    // Never collect more than the total return owed
    const sweepAmount = Math.min(rawSweep, remaining);

    if (sweepAmount <= 0) {
      this.logger.log(`No sweep needed for listing ${activeListing.id}`);
      return;
    }

    // Debit the business's ledger — this portion of the merchant wallet is
    // no longer theirs; it belongs to the investors.
    const sweepRef = `sweep-${uuidv4()}`;
    await this.ledgerService.debit({
      userId: businessUserId,
      amount: sweepAmount,
      purpose: 'sweep_contribution',
      referenceId: activeListing.id,
      referenceType: 'listing',
      squadTransactionReference: sweepRef,
    });

    const [sweepEvent] = await db
      .insert(sweepEvents)
      .values({
        listingId: activeListing.id,
        incomingPaymentAmount: incomingAmount,
        sweepPercent: String(sweepPercent),
        sweepAmount,
        netAmountRetained: incomingAmount - sweepAmount,
        squadWebhookReference: transactionRef,
        processedAt: new Date(),
      })
      .returning();

    const newTotalSwept = totalSwept + sweepAmount;
    await db
      .update(listings)
      .set({ totalSwept: newTotalSwept, updatedAt: new Date() })
      .where(eq(listings.id, activeListing.id));

    await this.distributeToInvestors(
      activeListing.id,
      sweepEvent.id,
      sweepAmount,
    );

    if (newTotalSwept >= totalReturnAmount) {
      await this.closeDeal(activeListing.id, bp.id, bp.userId);
    }

    await this.checkTrancheReleases(activeListing.id, bp);

    // Rating recalculation is non-critical
    this.triggerRatingRecalculation(bp.id).catch((e) =>
      this.logger.error(`Rating recalc failed: ${e}`),
    );
  }

  private async distributeToInvestors(
    listingId: string,
    sweepEventId: string,
    sweepAmount: number,
  ) {
    const activeInvestments = await db
      .select()
      .from(investments)
      .where(
        and(
          eq(investments.listingId, listingId),
          eq(investments.status, 'active'),
        ),
      );

    for (const investment of activeInvestments) {
      const sharePercent = Number(investment.sharePercent ?? 0);
      const distributionAmount = Math.round((sweepAmount * sharePercent) / 100);
      if (distributionAmount <= 0) continue;

      const distRef = `dist-${uuidv4()}`;
      // Credit the investor's internal balance. They can later withdraw via
      // the payouts API which calls Squad's /payout/transfer.
      await this.ledgerService.credit({
        userId: investment.investorId,
        amount: distributionAmount,
        purpose: 'sweep_distribution',
        referenceId: investment.id,
        referenceType: 'investment',
        squadTransactionReference: distRef,
      });

      await db.insert(sweepDistributions).values({
        sweepEventId,
        investmentId: investment.id,
        amountDistributed: distributionAmount,
        squadTransferReference: distRef,
      });

      const newReceived =
        (investment.totalReturnReceived ?? 0) + distributionAmount;
      const isInvestmentComplete =
        newReceived >= (investment.totalReturnDue ?? 0);

      await db
        .update(investments)
        .set({
          totalReturnReceived: newReceived,
          status: isInvestmentComplete ? 'completed' : 'active',
          updatedAt: new Date(),
        })
        .where(eq(investments.id, investment.id));

      await db.insert(notifications).values({
        userId: investment.investorId,
        title: 'Return received',
        body: `₦${(distributionAmount / 100).toLocaleString('en-NG')} was distributed to your wallet from a sweep.`,
      });
    }
  }

  private async closeDeal(
    listingId: string,
    businessId: string,
    businessUserId: string,
  ) {
    await db
      .update(listings)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(listings.id, listingId));

    const [bp] = await db
      .select({
        completedRepaymentCount: businessProfiles.completedRepaymentCount,
        tier: businessProfiles.tier,
      })
      .from(businessProfiles)
      .where(eq(businessProfiles.id, businessId));

    const newCount = (bp?.completedRepaymentCount ?? 0) + 1;
    const updates: Partial<typeof businessProfiles.$inferInsert> = {
      completedRepaymentCount: newCount,
      updatedAt: new Date(),
    };

    // Promote tier 1 businesses to tier 2 after 5 completed deals
    if (newCount >= 5 && (bp?.tier ?? 1) === 1) {
      updates.tier = 2;
    }

    await db
      .update(businessProfiles)
      .set(updates)
      .where(eq(businessProfiles.id, businessId));

    await db.insert(notifications).values({
      userId: businessUserId,
      title: 'Deal completed!',
      body: 'Your listing has been fully repaid. Congratulations!',
    });
  }

  private async checkTrancheReleases(
    listingId: string,
    bp: typeof businessProfiles.$inferSelect,
  ) {
    const eventCount = await db
      .select({ count: count() })
      .from(sweepEvents)
      .where(eq(sweepEvents.listingId, listingId));

    const total = eventCount[0]?.count ?? 0;

    // Tranche 2 releases after 2nd sweep, tranche 3 after 4th sweep
    const trancheConditions: Array<{ number: number; minEvents: number }> = [
      { number: 2, minEvents: 2 },
      { number: 3, minEvents: 4 },
    ];

    for (const tc of trancheConditions) {
      if (total < tc.minEvents) continue;

      const [tranche] = await db
        .select()
        .from(tranches)
        .where(
          and(
            eq(tranches.listingId, listingId),
            eq(tranches.trancheNumber, tc.number),
            eq(tranches.status, 'locked'),
          ),
        );

      if (!tranche) continue;

      await this.releaseTrancheToBusiness(tranche, bp.userId);
    }
  }

  // Capital tranches leave the merchant wallet via a real Squad payout. The
  // business's ledger is not touched here — escrowed investor capital was
  // never credited to them.
  private async releaseTrancheToBusiness(
    tranche: typeof tranches.$inferSelect,
    businessUserId: string,
  ) {
    const [busUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, businessUserId));

    if (!busUser?.beneficiaryAccount) {
      this.logger.error(
        `Cannot release tranche ${tranche.id}: business has no beneficiary account`,
      );
      return;
    }

    const ref = `tranche${tranche.trancheNumber}-${tranche.id}`;
    // Bank code for the GTBank settlement default — businesses register their
    // GTBank beneficiary at signup. For non-GTBank destinations, the business
    // should withdraw using the explicit payouts endpoint instead.
    const bankCode = '058';

    let transferStatus = 'failed';
    try {
      const result = await this.squadService.initiateTransfer(
        tranche.amount,
        bankCode,
        busUser.beneficiaryAccount,
        busUser.fullName,
        ref,
        `Tranche ${tranche.trancheNumber} release`,
      );
      transferStatus = result.status;
    } catch (err) {
      this.logger.error(
        `Tranche ${tranche.trancheNumber} payout failed: ${String(err)}`,
      );
      return;
    }

    if (transferStatus === 'failed' || transferStatus === 'reversed') {
      this.logger.error(
        `Tranche ${tranche.trancheNumber} transfer was not successful (${transferStatus})`,
      );
      return;
    }

    await db
      .update(tranches)
      .set({
        status: 'released',
        releasedAt: new Date(),
        squadTransferReference: ref,
      })
      .where(eq(tranches.id, tranche.id));

    await db.insert(notifications).values({
      userId: businessUserId,
      title: `Tranche ${tranche.trancheNumber} released`,
      body: `₦${(tranche.amount / 100).toLocaleString('en-NG')} has been transferred to your bank account.`,
    });
  }

  async repayFull(listingId: string, userId: string) {
    const [bp] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId));

    if (!bp) throw new NotFoundException('Business profile not found');

    const [listing] = await db
      .select()
      .from(listings)
      .where(and(eq(listings.id, listingId), eq(listings.businessId, bp.id)));

    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.status !== 'funded') {
      throw new BadRequestException(
        'Full repayment is only available for funded listings',
      );
    }

    const remaining =
      (listing.totalReturnAmount ?? 0) - (listing.totalSwept ?? 0);
    if (remaining <= 0) {
      throw new BadRequestException('This listing has no remaining balance');
    }

    // The business must have enough already deposited (and unswept) to cover
    // the remaining balance. We don't initiate a Squad collection here —
    // funds must already be in the merchant wallet, allocated to the business.
    const businessBalance =
      await this.ledgerService.getAvailableBalance(userId);
    if (businessBalance < remaining) {
      throw new BadRequestException(
        `Insufficient wallet balance to repay in full. Need ₦${(remaining / 100).toLocaleString('en-NG')}, available ₦${(businessBalance / 100).toLocaleString('en-NG')}. Top up your wallet first.`,
      );
    }

    // Release any still-locked tranches — the business is fully repaying so
    // they're owed all committed capital.
    const lockedTranches = await db
      .select()
      .from(tranches)
      .where(
        and(eq(tranches.listingId, listingId), eq(tranches.status, 'locked')),
      );

    for (const tranche of lockedTranches) {
      await this.releaseTrancheToBusiness(tranche, bp.userId);
    }

    // Debit the business's ledger for the full remaining balance, then
    // distribute it to investors as a single synthetic sweep event.
    const repayRef = `manual-repay-${uuidv4()}`;
    await this.ledgerService.debit({
      userId,
      amount: remaining,
      purpose: 'sweep_contribution',
      referenceId: listingId,
      referenceType: 'listing',
      squadTransactionReference: repayRef,
    });

    const [sweepEvent] = await db
      .insert(sweepEvents)
      .values({
        listingId,
        incomingPaymentAmount: remaining,
        sweepPercent: '100.00',
        sweepAmount: remaining,
        netAmountRetained: 0,
        squadWebhookReference: repayRef,
        isManualRepayment: true,
        processedAt: new Date(),
      })
      .returning();

    await db
      .update(listings)
      .set({ totalSwept: listing.totalReturnAmount, updatedAt: new Date() })
      .where(eq(listings.id, listingId));

    await this.distributeToInvestors(listingId, sweepEvent.id, remaining);
    await this.closeDeal(listingId, bp.id, bp.userId);

    this.triggerRatingRecalculation(bp.id).catch((e) =>
      this.logger.error(`Rating recalc failed: ${e}`),
    );

    return {
      repaid: remaining,
      message: `₦${(remaining / 100).toLocaleString('en-NG')} repaid. Your listing is now completed.`,
    };
  }

  private async triggerRatingRecalculation(businessId: string) {
    await this.bridgeRatingService.recalculate(businessId, 'sweep');
  }
}
