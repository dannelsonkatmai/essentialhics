import { HicsRole } from '@prisma/client';
import { Request } from 'express';

export interface TokenPayload {
  sub: string;       // userId
  email: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  healthSystemId: string;
  sessionId: string;
  roles: UserRoleContext[];
}

export interface UserRoleContext {
  facilityId: string;
  role: HicsRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

// Named permissions following resource:action convention
export type Permission =
  | 'iap:create' | 'iap:read' | 'iap:edit' | 'iap:approve' | 'iap:publish'
  | 'incident:create' | 'incident:read' | 'incident:close'
  | 'resource:request' | 'resource:approve' | 'resource:assign' | 'resource:read'
  | 'cost:read' | 'cost:edit' | 'cost:approve'
  | 'user:create' | 'user:read' | 'user:edit' | 'user:deactivate'
  | 'facility:read' | 'facility:edit'
  | 'audit_log:read'
  | 'report:read' | 'report:export';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  code?: string;
}

// canDo context for scoped permission checks
export interface CanDoContext {
  facilityId?: string;
  incidentId?: string;
}
