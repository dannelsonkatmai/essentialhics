import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/tokens';
import { prisma } from '../config/database';
import logger from '../config/logger';

export type HicsSocket = Socket & {
  userId: string;
  facilityIds: string[];
};

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer, frontendUrl: string): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: frontendUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // JWT authentication middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = verifyAccessToken(token);

      const user = await prisma.user.findUnique({
        where: { id: payload.sub, isDeleted: false, isActive: true },
        include: {
          userFacilityRoles: {
            where: { isActive: true },
            select: { facilityId: true },
          },
        },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      (socket as HicsSocket).userId = user.id;
      (socket as HicsSocket).facilityIds = user.userFacilityRoles.map((r) => r.facilityId);

      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const hicsSocket = socket as HicsSocket;
    logger.info(`WebSocket connected: userId=${hicsSocket.userId}`);

    // Join facility rooms automatically
    hicsSocket.facilityIds.forEach((fid) => {
      socket.join(`facility:${fid}`);
    });

    // Join an incident room on demand (verified server-side)
    socket.on('join:incident', async (incidentId: string) => {
      try {
        const incident = await prisma.incident.findFirst({
          where: {
            id: incidentId,
            isDeleted: false,
            facilityId: { in: hicsSocket.facilityIds },
          },
          select: { id: true },
        });

        if (!incident) {
          socket.emit('error', { message: 'Incident not found or access denied' });
          return;
        }

        socket.join(`incident:${incidentId}`);
        logger.debug(`Socket ${socket.id} joined incident:${incidentId}`);
      } catch (err) {
        logger.error('join:incident error', err);
      }
    });

    socket.on('leave:incident', (incidentId: string) => {
      socket.leave(`incident:${incidentId}`);
    });

    socket.on('disconnect', () => {
      logger.debug(`WebSocket disconnected: userId=${hicsSocket.userId}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialised');
  return io;
}

// Typed event emitters called from business logic

export function emitToIncident(incidentId: string, event: string, data: unknown): void {
  getIO().to(`incident:${incidentId}`).emit(event, data);
}

export function emitToFacility(facilityId: string, event: string, data: unknown): void {
  getIO().to(`facility:${facilityId}`).emit(event, data);
}

// Well-known event names
export const SocketEvents = {
  // Phase 2
  POSITION_ASSIGNED: 'position:assigned',
  POSITION_RELIEVED: 'position:relieved',
  POSITION_VACANT: 'position:vacant',
  IAP_STATUS_CHANGED: 'iap:status_changed',
  IAP_FORM_SAVED: 'iap:form_saved',
  NOTIFICATION_NEW: 'notification:new',
  // Phase 3
  RESOURCE_STATUS_CHANGED: 'resource:status_changed',
  REQUEST_STATUS_CHANGED: 'request:status_changed',
  COST_ROLLUP_UPDATED: 'cost:rollup_updated',
  EXPORT_JOB_PROGRESS: 'export:progress',
} as const;
