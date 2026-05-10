import { Injectable } from '@nestjs/common';
import { db } from '../../db';
import { notifications } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class NotificationsService {
  async getAll(userId: string) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markRead(notificationId: string, userId: string) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, notificationId));
    return { success: true };
  }

  async markAllRead(userId: string) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, userId));
    return { success: true };
  }
}
