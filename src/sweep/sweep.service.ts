import { Injectable, Logger } from '@nestjs/common';
import { db } from '../db';
import {
  users,
  businessProfiles,
  listings,
  investments,
  sweepEvents,
  sweepDistributions,
  tranches,
  notifications,
} from '../db/schema';
import { eq, and, or, count } from 'drizzle-orm';
import { SquadService } from '../squad/squad.service';
import { DynamicSweepService } from './dynamic-sweep.service';
import { BridgeRatingService } from '../bridge-rating/bridge-rating.service';
import { v4 as uuidv4 } from 'uuid';

// Central Squad virtual account that holds swept funds before distributing to investors
const PLATFORM_ESCROW_ACCOUNT = process.env.SQUAD_ESCROW_ACCOUNT ?? 'ESCROW_ACCOUNT';

@Injectable()
export class SweepService {
  private readonly logger = new Logger(SweepService.name);

  constructor(
    private squadService: SquadService,
    private dynamicSweepService: DynamicSweepService,
    private bridgeRatingService: BridgeRatingService,
  ) {}

  // Entry point from the webhook controller; only processes successful payment events
  async handleSquadWebhook(payload: Record<string, unknown>) {
    // Squad uses capital "Event" for card/transfer payments; VA payments have no event type but carry channel: "virtual-account"
    const eventType = (payload.Event ?? payload.event) as string | undefined;
    const channel = payload.channel as string | undefined;
    this.logger.log(`Squad webhook received — Event: ${eventType}, channel: ${channel}`);

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
    const transactionRef = (data.transaction_reference ?? data.TransactionRef ?? data.reference) as string;
    // VA webhooks use principal_amount; fallback covers other payment types
    const amount = Number(data.principal_amount ?? data.amount ?? 0);

    if (!virtualAccountNumber || !transactionRef) {
      this.logger.warn('Missing virtualAccountNumber or transactionRef in webhook');
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.squadVirtualAccountNumber, virtualAccountNumber));

    if (!user) return;
    if (user.userType !== 'business') return;

    // Idempotency check
    const existing = await db
      .select({ id: sweepEvents.id })
      .from(sweepEvents)
      .where(eq(sweepEvents.squadWebhookReference, transactionRef));

    if (existing.length > 0) {
      this.logger.log(`Duplicate webhook ignored: ${transactionRef}`);
      return;
    }

    const [bp] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, user.id));

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
      await this.dynamicSweepService.calculateSweep(activeListing.id, amount);

    const totalSwept = (activeListing.totalSwept ?? 0);
    const totalReturnAmount = activeListing.totalReturnAmount ?? 0;
    const remaining = totalReturnAmount - totalSwept;
    // Cap the sweep at what's actually still owed so we never over-collect
    const sweepAmount = Math.min(rawSweep, remaining);

    if (sweepAmount <= 0) {
      this.logger.log(`No sweep needed for listing ${activeListing.id}`);
      return;
    }

    const sweepRef = `sweep-${uuidv4()}`;
    try {
      await this.squadService.transferBetweenVirtualAccounts(
        user.squadVirtualAccountNumber!,
        PLATFORM_ESCROW_ACCOUNT,
        sweepAmount,
        sweepRef,
      );
    } catch (err) {
      this.logger.error(`Sweep transfer failed: ${err}`);
      return;
    }

    const [sweepEvent] = await db
      .insert(sweepEvents)
      .values({
        listingId: activeListing.id,
        incomingPaymentAmount: amount,
        sweepPercent: String(sweepPercent),
        sweepAmount,
        netAmountRetained: amount - sweepAmount,
        squadWebhookReference: transactionRef,
        processedAt: new Date(),
      })
      .returning();

    const newTotalSwept = totalSwept + sweepAmount;
    await db
      .update(listings)
      .set({ totalSwept: newTotalSwept, updatedAt: new Date() })
      .where(eq(listings.id, activeListing.id));

    await this.distributeToInvestors(activeListing.id, sweepEvent.id, sweepAmount);

    const isComplete = newTotalSwept >= totalReturnAmount;
    if (isComplete) {
      await this.closeDeal(activeListing.id, bp.id, bp.userId);
    }

    await this.checkTrancheReleases(activeListing.id, bp);

    // Rating recalculation is non-critical — run it async so we don't delay the webhook response
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
      .where(and(eq(investments.listingId, listingId), eq(investments.status, 'active')));

    for (const investment of activeInvestments) {
      const sharePercent = Number(investment.sharePercent ?? 0);
      const distributionAmount = Math.round((sweepAmount * sharePercent) / 100);

      if (distributionAmount <= 0) continue;

      const [investorUser] = await db
        .select({ squadVirtualAccountNumber: users.squadVirtualAccountNumber })
        .from(users)
        .where(eq(users.id, investment.investorId));

      if (!investorUser?.squadVirtualAccountNumber) continue;

      const distRef = `dist-${uuidv4()}`;
      try {
        await this.squadService.transferBetweenVirtualAccounts(
          PLATFORM_ESCROW_ACCOUNT,
          investorUser.squadVirtualAccountNumber,
          distributionAmount,
          distRef,
        );
      } catch (err) {
        this.logger.error(`Distribution to investor ${investment.investorId} failed: ${err}`);
        continue;
      }

      await db.insert(sweepDistributions).values({
        sweepEventId,
        investmentId: investment.id,
        amountDistributed: distributionAmount,
        squadTransferReference: distRef,
      });

      const newReceived = (investment.totalReturnReceived ?? 0) + distributionAmount;
      const isInvestmentComplete = newReceived >= (investment.totalReturnDue ?? 0);

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
        body: `₦${distributionAmount / 100} was distributed to your wallet from a sweep.`,
      });
    }
  }

  private async closeDeal(listingId: string, businessId: string, businessUserId: string) {
    await db
      .update(listings)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(listings.id, listingId));

    const [bp] = await db
      .select({ completedRepaymentCount: businessProfiles.completedRepaymentCount, tier: businessProfiles.tier })
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

  private async checkTrancheReleases(listingId: string, bp: typeof businessProfiles.$inferSelect) {
    const eventCount = await db
      .select({ count: count() })
      .from(sweepEvents)
      .where(eq(sweepEvents.listingId, listingId));

    const total = eventCount[0]?.count ?? 0;

    const [busUser] = await db
      .select({ squadVirtualAccountNumber: users.squadVirtualAccountNumber })
      .from(users)
      .where(eq(users.id, bp.userId));

    if (!busUser?.squadVirtualAccountNumber) return;

    // Tranche 2 releases after 2nd sweep, tranche 3 after 4th sweep
    const trancheConditions: Array<{ number: number; minEvents: number }> = [
      { number: 2, minEvents: 2 },
      { number: 3, minEvents: 4 },
    ];

    for (const tc of trancheConditions) {
      if (total >= tc.minEvents) {
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

        if (tranche) {
          const ref = `tranche${tc.number}-${uuidv4()}`;
          try {
            await this.squadService.transferBetweenVirtualAccounts(
              PLATFORM_ESCROW_ACCOUNT,
              busUser.squadVirtualAccountNumber!,
              tranche.amount,
              ref,
            );
          } catch {}

          await db
            .update(tranches)
            .set({ status: 'released', releasedAt: new Date(), squadTransferReference: ref })
            .where(eq(tranches.id, tranche.id));

          await db.insert(notifications).values({
            userId: bp.userId,
            title: `Tranche ${tc.number} released`,
            body: `₦${tranche.amount / 100} has been released to your account.`,
          });
        }
      }
    }
  }

  private async triggerRatingRecalculation(businessId: string) {
    await this.bridgeRatingService.recalculate(businessId, 'sweep');
  }
}
