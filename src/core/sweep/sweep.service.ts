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

  async handleSquadWebhook(payload: Record<string, unknown>) {
    console.log('handle reached', payload);
    const eventType = (payload.Event ?? payload.event) as string | undefined;
    const channel = payload.channel as string | undefined;
    const nestedData = (payload.data ?? {}) as Record<string, unknown>;
    const nestedChannel = nestedData.channel as string | undefined;

    this.logger.log(
      `Squad webhook received — Event: ${eventType}, channel: ${channel ?? nestedChannel ?? 'none'}`,
    );

    const isVaPayment =
      channel === 'virtual-account' ||
      nestedChannel === 'virtual-account' ||
      !!payload.virtual_account_number ||
      !!nestedData.virtual_account_number ||
      eventType === 'charge_successful';

    const isCheckoutPayment = eventType === 'charge.success';

    if (isVaPayment) {
      await this.handleVaPaymentSuccessful(payload);
    } else if (isCheckoutPayment) {
      await this.handleCheckoutPaymentSuccessful(payload);
    } else {
      this.logger.warn(
        `Squad webhook skipped — unknown event or channel. ` +
          `Event: ${eventType}, keys: ${Object.keys(payload).join(', ')}`,
      );
    }
  }

  private async handleVaPaymentSuccessful(payload: Record<string, unknown>) {
    const data = (payload.data ?? payload) as Record<string, unknown>;
    const virtualAccountNumber = data.virtual_account_number as string;
    const transactionRef = (data.transaction_reference ??
      data.TransactionRef ??
      data.reference) as string;
    const amount = data.principal_amount
      ? Math.round(Number(data.principal_amount) * 100)
      : Number(data.amount ?? 0);

    if (!virtualAccountNumber || !transactionRef) {
      this.logger.warn('Missing fields in VA webhook');
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.squadVirtualAccountNumber, virtualAccountNumber));

    if (!user) {
      this.logger.warn(`Unknown VA ${virtualAccountNumber}`);
      return;
    }

    await this.processFinalCredit(user.id, user.userType, amount, transactionRef);
  }

  private async handleCheckoutPaymentSuccessful(payload: Record<string, unknown>) {
    const transactionRef = payload.TransactionRef as string;
    const body = (payload.Body ?? {}) as Record<string, unknown>;
    const amount = Number(body.amount ?? 0);
    const email = body.email as string;

    this.logger.log(`Processing checkout payment — ref: ${transactionRef}, amount: ${amount}`);

    // Try to extract userId from ref: BRIDGE_TXN_<userId>_<timestamp>
    let userId: string | undefined;
    if (transactionRef.startsWith('BRIDGE_TXN_')) {
      const parts = transactionRef.split('_');
      if (parts.length >= 3) {
        userId = parts[2];
      }
    }

    let user;
    if (userId) {
      [user] = await db.select().from(users).where(eq(users.id, userId));
    }

    if (!user && email) {
      [user] = await db.select().from(users).where(eq(users.email, email));
    }

    if (!user) {
      this.logger.warn(`Could not find user for checkout payment ${transactionRef}`);
      return;
    }

    await this.processFinalCredit(user.id, user.userType, amount, transactionRef);
  }

  private async processFinalCredit(
    userId: string,
    userType: string,
    amount: number,
    transactionRef: string,
  ) {
    if (amount <= 0) return;

    if (await this.ledgerService.hasEntryForSquadReference(transactionRef)) {
      this.logger.log(`Duplicate webhook ignored: ${transactionRef}`);
      return;
    }

    await this.ledgerService.credit({
      userId,
      amount,
      purpose: 'deposit',
      squadTransactionReference: transactionRef,
    });

    const title =
      userType === 'business'
        ? `₦${(amount / 100).toLocaleString('en-NG')} deposit was successful, 1% service fees apply`
        : `₦${(amount / 100).toLocaleString('en-NG')} deposit was successful`;

    await db.insert(notifications).values({
      userId,
      title,
      body: `Your account was just credited with ₦${(amount / 100).toLocaleString('en-NG')}.`,
    });

    if (userType === 'business') {
      await this.processBusinessSweep(userId, amount, transactionRef);
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
          eq(listings.status, 'funded'),
        ),
      );

    if (!activeListing) return;

    // 1. Calculate and debit the 1% Platform Service Fee from the GROSS revenue.
    const platformFee = Math.round(incomingAmount * 0.01);
    const platformUserId = await this.ledgerService.getSystemUserId();

    if (platformFee > 0) {
      await this.ledgerService.debit({
        userId: businessUserId,
        amount: platformFee,
        purpose: 'service_fee',
        referenceId: activeListing.id,
        referenceType: 'listing',
        squadTransactionReference: `${transactionRef}_fee`,
      });

      await this.ledgerService.credit({
        userId: platformUserId,
        amount: platformFee,
        purpose: 'service_fee',
        referenceId: activeListing.id,
        referenceType: 'listing',
        squadTransactionReference: `${transactionRef}_fee`,
      });
    }

    // 2. Calculate the sweep amount (debt repayment) FROM THE NET (Gross - 1% Fee)
    const amountAfterFee = incomingAmount - platformFee;
    const { sweepAmount: rawSweep, sweepPercent } =
      await this.dynamicSweepService.calculateSweep(
        activeListing.id,
        amountAfterFee,
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
        serviceFee: platformFee,
        netAmountRetained: incomingAmount - sweepAmount - platformFee,
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
      bp.businessName ?? 'a business',
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
    businessName: string,
  ) {
    // The full sweepAmount is distributed to investors according to their share.
    // The platform fee was already deducted from the business in processBusinessSweep.
    const amountToDistribute = sweepAmount;

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
      const distributionAmount = Math.round(
        (amountToDistribute * sharePercent) / 100,
      );
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

      // Check if the investment is complete.
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
        title: `₦${(distributionAmount / 100).toLocaleString('en-NG')} return was successful`,
        body: `Your wallet was credited with ₦${(distributionAmount / 100).toLocaleString('en-NG')} from ${businessName}.`,
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

    // Ledger accounting for tranche release
    await this.ledgerService.credit({
      userId: businessUserId,
      amount: tranche.amount,
      purpose: 'tranche_release',
      referenceId: tranche.id,
      referenceType: 'tranche',
      squadTransactionReference: `release-${ref}`,
    });

    await this.ledgerService.debit({
      userId: businessUserId,
      amount: tranche.amount,
      purpose: 'tranche_payout',
      referenceId: tranche.id,
      referenceType: 'tranche',
      squadTransactionReference: ref,
    });

    await db.insert(notifications).values({
      userId: businessUserId,
      title: `₦${(tranche.amount / 100).toLocaleString('en-NG')} Tranche ${tranche.trancheNumber} has been released.`,
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

    const platformFee = Math.round(remaining * 0.01);
    const totalRequired = remaining + platformFee;

    // The business must have enough already deposited (and unswept) to cover
    // the remaining balance + platform fee. We don't initiate a Squad collection here —
    // funds must already be in the merchant wallet, allocated to the business.
    const businessBalance =
      await this.ledgerService.getAvailableBalance(userId);
    if (businessBalance < totalRequired) {
      throw new BadRequestException(
        `Insufficient wallet balance to repay in full with fees. Need ₦${(totalRequired / 100).toLocaleString('en-NG')}, available ₦${(businessBalance / 100).toLocaleString('en-NG')}. Top up your wallet first.`,
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

    const repayRef = `manual-repay-${uuidv4()}`;

    // 1. Collect platform fee
    if (platformFee > 0) {
      const platformUserId = await this.ledgerService.getSystemUserId();
      await this.ledgerService.debit({
        userId,
        amount: platformFee,
        purpose: 'service_fee',
        referenceId: listingId,
        referenceType: 'listing',
        squadTransactionReference: `${repayRef}_fee`,
      });
      await this.ledgerService.credit({
        userId: platformUserId,
        amount: platformFee,
        purpose: 'service_fee',
        referenceId: listingId,
        referenceType: 'listing',
        squadTransactionReference: `${repayRef}_fee`,
      });
    }

    // 2. Debit the business's ledger for the full remaining balance, then
    // distribute it to investors as a single synthetic sweep event.
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
        serviceFee: platformFee,
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

    await this.distributeToInvestors(
      listingId,
      sweepEvent.id,
      remaining,
      bp.businessName ?? 'a business',
    );
    await this.closeDeal(listingId, bp.id, bp.userId);

    await db.insert(notifications).values({
      userId,
      title: `₦${(remaining / 100).toLocaleString('en-NG')} one time payment was successful, 1% service fees apply`,
      body: `You have successfully repaid your listing in full. Platform fee of ₦${(platformFee / 100).toLocaleString('en-NG')} was also deducted.`,
    });

    this.triggerRatingRecalculation(bp.id).catch((e) =>
      this.logger.error(`Rating recalc failed: ${e}`),
    );

    return {
      repaid: remaining,
      serviceFee: platformFee,
      message: `₦${(remaining / 100).toLocaleString('en-NG')} repaid (₦${(platformFee / 100).toLocaleString('en-NG')} service fee). Your listing is now completed.`,
    };
  }

  private async triggerRatingRecalculation(businessId: string) {
    await this.bridgeRatingService.recalculate(businessId, 'sweep');
  }
}
