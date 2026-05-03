import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { verifyAccessToken } from '../utils/tokens';
import type { AuthenticatedRequest, AuthenticatedUser } from '../types';

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' });
    return;
  }

  // Load current roles from DB so they're always up-to-date
  const user = await prisma.user.findUnique({
    where: { id: payload.sub, isDeleted: false },
    include: {
      userFacilityRoles: {
        where: { isDeleted: false },
        select: { facilityId: true, hicsRole: true },
      },
    },
  });

  if (!user || !user.isActive) {
    res.status(401).json({ message: 'Account is inactive or not found.' });
    return;
  }

  if (user.isLocked && user.lockedUntil && user.lockedUntil > new Date()) {
    res.status(403).json({ message: 'Account is temporarily locked.' });
    return;
  }

  const authUser: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    healthSystemId: user.healthSystemId,
    sessionId: payload.sessionId,
    roles: user.userFacilityRoles.map((r) => ({
      facilityId: r.facilityId,
      role: r.hicsRole,
    })),
  };

  (req as AuthenticatedRequest).user = authUser;
  next();
}
