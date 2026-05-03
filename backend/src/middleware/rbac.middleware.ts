import { Response, NextFunction } from 'express';
import { canDo } from '../utils/permissions';
import type { Permission, AuthenticatedRequest } from '../types';

/**
 * Middleware factory that checks a permission, optionally scoped to a facility.
 *
 * The facilityId is resolved in order:
 *   1. req.params.facilityId (from route, e.g. /facilities/:facilityId/...)
 *   2. req.body.facilityId
 *   3. req.query.facilityId
 *
 * Pass `scopeFacility: false` to skip the facility scope check (system-level routes).
 */
export function requirePermission(
  permission: Permission,
  options: { scopeFacility?: boolean } = { scopeFacility: true },
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const { user } = req;

    const facilityId = options.scopeFacility !== false
      ? (req.params.facilityId ?? req.body?.facilityId ?? req.query?.facilityId as string | undefined)
      : undefined;

    if (!canDo(user, permission, facilityId ? { facilityId } : undefined)) {
      res.status(403).json({ message: 'You do not have permission to perform this action.' });
      return;
    }
    next();
  };
}

/**
 * Convenience middleware for routes that require any of several permissions.
 */
export function requireAnyPermission(permissions: Permission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const { user } = req;
    const facilityId = req.params.facilityId ?? req.body?.facilityId;

    const hasAny = permissions.some((p) =>
      canDo(user, p, facilityId ? { facilityId } : undefined),
    );

    if (!hasAny) {
      res.status(403).json({ message: 'You do not have permission to perform this action.' });
      return;
    }
    next();
  };
}
