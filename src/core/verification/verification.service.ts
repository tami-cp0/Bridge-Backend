import { Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../../db';
import { businessProfiles, bridgeRatings } from '../../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class VerificationService {
  async verifyCac(userId: string, cacRegistrationNumber: string) {
    const [bp] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.userId, userId));

    if (!bp) throw new NotFoundException('Business profile not found');

    await db
      .update(businessProfiles)
      .set({
        cacVerified: true,
        cacRegistrationNumber,
        updatedAt: new Date(),
      })
      .where(eq(businessProfiles.userId, userId));

    // CAC verification unlocks a 5-point bonus on the Bridge Rating
    await db
      .update(bridgeRatings)
      .set({ cacBonusScore: '5', updatedAt: new Date() })
      .where(eq(bridgeRatings.businessId, bp.id));

    return { verified: true };
  }
}
