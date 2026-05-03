import { NotificationType } from '@prisma/client';
import { prisma } from '../../config/database';
import { emitToFacility, SocketEvents } from '../../socket';
import type { AuthenticatedUser } from '../../types';

export interface CreateNotificationDto {
  recipientUserId: string;
  facilityId?: string;
  incidentId?: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(dto: CreateNotificationDto): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      recipientUserId: dto.recipientUserId,
      facilityId: dto.facilityId ?? null,
      incidentId: dto.incidentId ?? null,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      actionUrl: dto.actionUrl ?? null,
      metadata: dto.metadata ?? {},
    },
  });

  // Deliver in-app via WebSocket — facility room ensures correct scope
  if (dto.facilityId) {
    emitToFacility(dto.facilityId, SocketEvents.NOTIFICATION_NEW, {
      id: notification.id,
      recipientUserId: dto.recipientUserId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      actionUrl: notification.actionUrl,
      createdAt: notification.createdAt,
    });
  }
}

export async function listNotifications(
  userId: string,
  query: { unreadOnly?: boolean; page: number; limit: number },
) {
  const where = {
    recipientUserId: userId,
    ...(query.unreadOnly ? { readAt: null } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    data: items,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { recipientUserId: userId, readAt: null } });
}

export async function markRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, recipientUserId: userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { recipientUserId: userId, readAt: null },
    data: { readAt: new Date() },
  });
}
