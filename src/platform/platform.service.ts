import { Injectable } from '@nestjs/common';
import { db } from '../db';
import { platformStats } from '../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class PlatformService {
  async getStats() {
    const [row] = await db
      .select()
      .from(platformStats)
      .where(eq(platformStats.id, 1));

    return (
      row ?? {
        totalBusinessesFunded: 0,
        totalCapitalDeployedKobo: 0,
        averageInvestorReturnPercent: 0,
        averageRepaymentDays: 0,
      }
    );
  }
}
