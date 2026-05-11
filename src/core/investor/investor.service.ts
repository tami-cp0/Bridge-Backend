import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { db } from '../../db';
import {
  investorProfiles,
  investments,
  notifications,
  users,
} from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { SquadService } from '../squad/squad.service';
import { SquadConfig } from '../../config/config';
import type { SquadConfigType } from '../../config/config.types';

@Injectable()
export class InvestorService {
  constructor(
    private squadService: SquadService,
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
    const query = db
      .select()
      .from(investments)
      .where(eq(investments.investorId, userId));

    const all = await query;
    if (!status) return all;
    return all.filter((i) => i.status === status);
  }

  async getWallet(userId: string) {
    const [user] = await db
      .select({ squadVirtualAccountNumber: users.squadVirtualAccountNumber })
      .from(users)
      .where(eq(users.id, userId));

    if (!user?.squadVirtualAccountNumber) {
      throw new NotFoundException('Virtual account not found');
    }

    // Live balance from Squad â€” not cached locally
    const availableBalance = await this.squadService.getAccountBalance(
      user.squadVirtualAccountNumber,
    );

    // Default pool balance is the sum of 4% contributions across all investments
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
    // Only update fields that were explicitly provided â€” ignore undefined ones
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
}
