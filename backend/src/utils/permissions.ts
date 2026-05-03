import { HicsRole } from '@prisma/client';
import type { Permission, AuthenticatedUser, CanDoContext } from '../types';

// ─── Permission matrix ────────────────────────────────────────────────────────
// Maps each HICS role to its granted permissions.

const ROLE_PERMISSIONS: Record<HicsRole, Permission[]> = {
  SYSTEM_ADMIN: [
    'iap:create', 'iap:read', 'iap:edit', 'iap:approve', 'iap:publish',
    'incident:create', 'incident:read', 'incident:close',
    'resource:request', 'resource:approve', 'resource:assign', 'resource:read',
    'cost:read', 'cost:edit', 'cost:approve',
    'user:create', 'user:read', 'user:edit', 'user:deactivate',
    'facility:read', 'facility:edit',
    'audit_log:read',
    'report:read', 'report:export',
  ],

  SYSTEM_VIEWER: [
    'iap:read', 'incident:read', 'resource:read', 'cost:read',
    'user:read', 'facility:read', 'audit_log:read', 'report:read',
  ],

  FACILITY_ADMIN: [
    'iap:create', 'iap:read', 'iap:edit', 'iap:approve', 'iap:publish',
    'incident:create', 'incident:read', 'incident:close',
    'resource:request', 'resource:approve', 'resource:assign', 'resource:read',
    'cost:read', 'cost:edit',
    'user:create', 'user:read', 'user:edit', 'user:deactivate',
    'facility:read', 'facility:edit',
    'audit_log:read',
    'report:read', 'report:export',
  ],

  INCIDENT_COMMANDER: [
    'iap:create', 'iap:read', 'iap:edit', 'iap:approve', 'iap:publish',
    'incident:create', 'incident:read', 'incident:close',
    'resource:request', 'resource:approve', 'resource:assign', 'resource:read',
    'cost:read', 'user:read', 'facility:read',
    'report:read', 'report:export',
  ],

  DEPUTY_INCIDENT_COMMANDER: [
    'iap:create', 'iap:read', 'iap:edit', 'iap:approve',
    'incident:read', 'incident:close',
    'resource:request', 'resource:approve', 'resource:assign', 'resource:read',
    'cost:read', 'user:read', 'facility:read',
    'report:read', 'report:export',
  ],

  PUBLIC_INFORMATION_OFFICER: [
    'iap:read', 'incident:read', 'resource:read', 'user:read',
    'facility:read', 'report:read', 'report:export',
  ],

  SAFETY_OFFICER: [
    'iap:read', 'incident:read', 'resource:read', 'user:read',
    'facility:read', 'report:read',
  ],

  LIAISON_OFFICER: [
    'iap:read', 'incident:read', 'resource:read', 'user:read',
    'facility:read', 'report:read',
  ],

  MEDICAL_TECHNICAL_SPECIALIST: [
    'iap:read', 'iap:edit', 'incident:read', 'resource:read', 'user:read',
    'facility:read', 'report:read',
  ],

  OPERATIONS_SECTION_CHIEF: [
    'iap:create', 'iap:read', 'iap:edit',
    'incident:read', 'incident:close',
    'resource:request', 'resource:approve', 'resource:assign', 'resource:read',
    'cost:read', 'user:read', 'facility:read', 'report:read', 'report:export',
  ],

  PLANNING_SECTION_CHIEF: [
    'iap:create', 'iap:read', 'iap:edit',
    'incident:read', 'resource:read', 'user:read',
    'facility:read', 'report:read', 'report:export',
  ],

  LOGISTICS_SECTION_CHIEF: [
    'iap:read', 'incident:read',
    'resource:request', 'resource:approve', 'resource:assign', 'resource:read',
    'user:read', 'facility:read', 'report:read', 'report:export',
  ],

  FINANCE_ADMIN_SECTION_CHIEF: [
    'iap:read', 'incident:read', 'resource:read',
    'cost:read', 'cost:edit', 'cost:approve',
    'user:read', 'facility:read', 'report:read', 'report:export',
  ],

  MEDICAL_CARE_BRANCH_DIRECTOR: [
    'iap:read', 'incident:read',
    'resource:request', 'resource:read', 'user:read', 'facility:read',
  ],

  INFRASTRUCTURE_BRANCH_DIRECTOR: [
    'iap:read', 'incident:read',
    'resource:request', 'resource:read', 'user:read', 'facility:read',
  ],

  SECURITY_BRANCH_DIRECTOR: [
    'iap:read', 'incident:read',
    'resource:request', 'resource:read', 'user:read', 'facility:read',
  ],

  BUSINESS_CONTINUITY_BRANCH_DIRECTOR: [
    'iap:read', 'incident:read',
    'resource:request', 'resource:read', 'user:read', 'facility:read',
  ],

  HAZMAT_BRANCH_DIRECTOR: [
    'iap:read', 'incident:read',
    'resource:request', 'resource:read', 'user:read', 'facility:read',
  ],

  PATIENT_FAMILY_INFORMATION_BRANCH_DIRECTOR: [
    'iap:read', 'incident:read', 'resource:read', 'user:read', 'facility:read',
  ],

  RESOURCES_UNIT_LEADER: [
    'iap:read', 'incident:read',
    'resource:request', 'resource:assign', 'resource:read',
    'user:read', 'facility:read', 'report:read',
  ],

  SITUATION_UNIT_LEADER: [
    'iap:read', 'iap:edit', 'incident:read',
    'resource:read', 'user:read', 'facility:read', 'report:read', 'report:export',
  ],

  DOCUMENTATION_UNIT_LEADER: [
    'iap:read', 'iap:edit', 'incident:read',
    'resource:read', 'user:read', 'facility:read', 'report:read', 'report:export',
  ],

  DEMOBILIZATION_UNIT_LEADER: [
    'iap:read', 'incident:read', 'resource:read', 'user:read', 'facility:read',
  ],

  SERVICE_BRANCH_DIRECTOR: [
    'iap:read', 'incident:read',
    'resource:request', 'resource:read', 'user:read', 'facility:read',
  ],

  SUPPORT_BRANCH_DIRECTOR: [
    'iap:read', 'incident:read',
    'resource:request', 'resource:read', 'user:read', 'facility:read',
  ],

  COMMUNICATIONS_UNIT_LEADER: [
    'iap:read', 'incident:read', 'resource:read', 'user:read', 'facility:read',
  ],

  IT_SYSTEMS_UNIT_LEADER: [
    'iap:read', 'incident:read', 'resource:read', 'user:read', 'facility:read',
  ],

  STAFF_FOOD_WATER_UNIT_LEADER: [
    'iap:read', 'incident:read', 'resource:request', 'resource:read',
    'user:read', 'facility:read',
  ],

  TRANSPORTATION_UNIT_LEADER: [
    'iap:read', 'incident:read', 'resource:request', 'resource:read',
    'user:read', 'facility:read',
  ],

  FACILITIES_UNIT_LEADER: [
    'iap:read', 'incident:read', 'resource:request', 'resource:read',
    'user:read', 'facility:read',
  ],

  SUPPLY_UNIT_LEADER: [
    'iap:read', 'incident:read', 'resource:request', 'resource:read',
    'user:read', 'facility:read',
  ],

  LABOR_POOL_CREDENTIALS_UNIT_LEADER: [
    'iap:read', 'incident:read', 'resource:read', 'user:read', 'facility:read',
  ],

  TIME_UNIT_LEADER: [
    'iap:read', 'incident:read', 'resource:read',
    'cost:read', 'cost:edit', 'user:read', 'facility:read',
  ],

  PROCUREMENT_UNIT_LEADER: [
    'iap:read', 'incident:read', 'resource:read',
    'cost:read', 'cost:edit', 'user:read', 'facility:read',
  ],

  COMPENSATION_CLAIMS_UNIT_LEADER: [
    'iap:read', 'incident:read', 'resource:read',
    'cost:read', 'cost:edit', 'user:read', 'facility:read',
  ],

  COST_UNIT_LEADER: [
    'iap:read', 'incident:read', 'resource:read',
    'cost:read', 'cost:edit', 'cost:approve', 'user:read', 'facility:read',
    'report:read', 'report:export',
  ],

  RESPONDER: [
    'iap:read', 'incident:read', 'resource:read', 'user:read', 'facility:read',
  ],

  READ_ONLY_OBSERVER: [
    'iap:read', 'incident:read', 'resource:read', 'facility:read',
  ],
};

// ─── canDo ────────────────────────────────────────────────────────────────────

/**
 * Checks whether an authenticated user holds a given permission, optionally
 * scoped to a specific facility (and in the future, incident).
 *
 * Rules:
 *  - SYSTEM_ADMIN bypasses facility scoping (full system access).
 *  - For all other roles, the facilityId must match the role assignment.
 *  - If no facilityId is provided the check is unscoped — any matching role wins.
 */
export function canDo(
  user: AuthenticatedUser,
  permission: Permission,
  context?: CanDoContext,
): boolean {
  for (const roleCtx of user.roles) {
    const perms = ROLE_PERMISSIONS[roleCtx.role] ?? [];
    if (!perms.includes(permission)) continue;

    // SYSTEM_ADMIN is always unscoped
    if (roleCtx.role === 'SYSTEM_ADMIN') return true;

    // If caller asks for facility-scoped check, role must match that facility
    if (context?.facilityId && roleCtx.facilityId !== context.facilityId) continue;

    return true;
  }
  return false;
}

export function getPermissionsForRole(role: HicsRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export { ROLE_PERMISSIONS };
