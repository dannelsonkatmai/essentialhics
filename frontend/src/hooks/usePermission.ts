import { useAuthStore } from '../stores/auth.store';
import type { Permission, HicsRole } from '../types';

// Mirror of the backend ROLE_PERMISSIONS for UI gating
const ROLE_PERMISSIONS: Record<HicsRole, Permission[]> = {
  SYSTEM_ADMIN: [
    'iap:create', 'iap:read', 'iap:edit', 'iap:approve', 'iap:publish',
    'incident:create', 'incident:read', 'incident:close',
    'resource:request', 'resource:approve', 'resource:assign', 'resource:read',
    'cost:read', 'cost:edit', 'cost:approve',
    'user:create', 'user:read', 'user:edit', 'user:deactivate',
    'facility:read', 'facility:edit', 'audit_log:read', 'report:read', 'report:export',
  ],
  SYSTEM_VIEWER: ['iap:read', 'incident:read', 'resource:read', 'cost:read', 'user:read', 'facility:read', 'audit_log:read', 'report:read'],
  FACILITY_ADMIN: [
    'iap:create', 'iap:read', 'iap:edit', 'iap:approve', 'iap:publish',
    'incident:create', 'incident:read', 'incident:close',
    'resource:request', 'resource:approve', 'resource:assign', 'resource:read',
    'cost:read', 'cost:edit',
    'user:create', 'user:read', 'user:edit', 'user:deactivate',
    'facility:read', 'facility:edit', 'audit_log:read', 'report:read', 'report:export',
  ],
  INCIDENT_COMMANDER: ['iap:create', 'iap:read', 'iap:edit', 'iap:approve', 'iap:publish', 'incident:create', 'incident:read', 'incident:close', 'resource:request', 'resource:approve', 'resource:assign', 'resource:read', 'cost:read', 'user:read', 'facility:read', 'report:read', 'report:export'],
  DEPUTY_INCIDENT_COMMANDER: ['iap:create', 'iap:read', 'iap:edit', 'iap:approve', 'incident:read', 'incident:close', 'resource:request', 'resource:approve', 'resource:assign', 'resource:read', 'cost:read', 'user:read', 'facility:read', 'report:read', 'report:export'],
  PUBLIC_INFORMATION_OFFICER: ['iap:read', 'incident:read', 'resource:read', 'user:read', 'facility:read', 'report:read', 'report:export'],
  SAFETY_OFFICER: ['iap:read', 'incident:read', 'resource:read', 'user:read', 'facility:read', 'report:read'],
  LIAISON_OFFICER: ['iap:read', 'incident:read', 'resource:read', 'user:read', 'facility:read', 'report:read'],
  MEDICAL_TECHNICAL_SPECIALIST: ['iap:read', 'iap:edit', 'incident:read', 'resource:read', 'user:read', 'facility:read', 'report:read'],
  OPERATIONS_SECTION_CHIEF: ['iap:create', 'iap:read', 'iap:edit', 'incident:read', 'incident:close', 'resource:request', 'resource:approve', 'resource:assign', 'resource:read', 'cost:read', 'user:read', 'facility:read', 'report:read', 'report:export'],
  PLANNING_SECTION_CHIEF: ['iap:create', 'iap:read', 'iap:edit', 'incident:read', 'resource:read', 'user:read', 'facility:read', 'report:read', 'report:export'],
  LOGISTICS_SECTION_CHIEF: ['iap:read', 'incident:read', 'resource:request', 'resource:approve', 'resource:assign', 'resource:read', 'user:read', 'facility:read', 'report:read', 'report:export'],
  FINANCE_ADMIN_SECTION_CHIEF: ['iap:read', 'incident:read', 'resource:read', 'cost:read', 'cost:edit', 'cost:approve', 'user:read', 'facility:read', 'report:read', 'report:export'],
  MEDICAL_CARE_BRANCH_DIRECTOR: ['iap:read', 'incident:read', 'resource:request', 'resource:read', 'user:read', 'facility:read'],
  INFRASTRUCTURE_BRANCH_DIRECTOR: ['iap:read', 'incident:read', 'resource:request', 'resource:read', 'user:read', 'facility:read'],
  SECURITY_BRANCH_DIRECTOR: ['iap:read', 'incident:read', 'resource:request', 'resource:read', 'user:read', 'facility:read'],
  BUSINESS_CONTINUITY_BRANCH_DIRECTOR: ['iap:read', 'incident:read', 'resource:request', 'resource:read', 'user:read', 'facility:read'],
  HAZMAT_BRANCH_DIRECTOR: ['iap:read', 'incident:read', 'resource:request', 'resource:read', 'user:read', 'facility:read'],
  PATIENT_FAMILY_INFORMATION_BRANCH_DIRECTOR: ['iap:read', 'incident:read', 'resource:read', 'user:read', 'facility:read'],
  RESOURCES_UNIT_LEADER: ['iap:read', 'incident:read', 'resource:request', 'resource:assign', 'resource:read', 'user:read', 'facility:read', 'report:read'],
  SITUATION_UNIT_LEADER: ['iap:read', 'iap:edit', 'incident:read', 'resource:read', 'user:read', 'facility:read', 'report:read', 'report:export'],
  DOCUMENTATION_UNIT_LEADER: ['iap:read', 'iap:edit', 'incident:read', 'resource:read', 'user:read', 'facility:read', 'report:read', 'report:export'],
  DEMOBILIZATION_UNIT_LEADER: ['iap:read', 'incident:read', 'resource:read', 'user:read', 'facility:read'],
  SERVICE_BRANCH_DIRECTOR: ['iap:read', 'incident:read', 'resource:request', 'resource:read', 'user:read', 'facility:read'],
  SUPPORT_BRANCH_DIRECTOR: ['iap:read', 'incident:read', 'resource:request', 'resource:read', 'user:read', 'facility:read'],
  COMMUNICATIONS_UNIT_LEADER: ['iap:read', 'incident:read', 'resource:read', 'user:read', 'facility:read'],
  IT_SYSTEMS_UNIT_LEADER: ['iap:read', 'incident:read', 'resource:read', 'user:read', 'facility:read'],
  STAFF_FOOD_WATER_UNIT_LEADER: ['iap:read', 'incident:read', 'resource:request', 'resource:read', 'user:read', 'facility:read'],
  TRANSPORTATION_UNIT_LEADER: ['iap:read', 'incident:read', 'resource:request', 'resource:read', 'user:read', 'facility:read'],
  FACILITIES_UNIT_LEADER: ['iap:read', 'incident:read', 'resource:request', 'resource:read', 'user:read', 'facility:read'],
  SUPPLY_UNIT_LEADER: ['iap:read', 'incident:read', 'resource:request', 'resource:read', 'user:read', 'facility:read'],
  LABOR_POOL_CREDENTIALS_UNIT_LEADER: ['iap:read', 'incident:read', 'resource:read', 'user:read', 'facility:read'],
  TIME_UNIT_LEADER: ['iap:read', 'incident:read', 'resource:read', 'cost:read', 'cost:edit', 'user:read', 'facility:read'],
  PROCUREMENT_UNIT_LEADER: ['iap:read', 'incident:read', 'resource:read', 'cost:read', 'cost:edit', 'user:read', 'facility:read'],
  COMPENSATION_CLAIMS_UNIT_LEADER: ['iap:read', 'incident:read', 'resource:read', 'cost:read', 'cost:edit', 'user:read', 'facility:read'],
  COST_UNIT_LEADER: ['iap:read', 'incident:read', 'resource:read', 'cost:read', 'cost:edit', 'cost:approve', 'user:read', 'facility:read', 'report:read', 'report:export'],
  RESPONDER: ['iap:read', 'incident:read', 'resource:read', 'user:read', 'facility:read'],
  READ_ONLY_OBSERVER: ['iap:read', 'incident:read', 'resource:read', 'facility:read'],
};

export function usePermission(permission: Permission, facilityId?: string): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;

  // user.roles come from JWT — for the frontend we rely on the stored roles
  // For robust UI gating we check against locally-known roles from the user profile
  const userRoles = (user as any).userFacilityRoles as Array<{ facilityId: string; hicsRole: HicsRole }> | undefined;
  if (!userRoles) return false;

  for (const roleCtx of userRoles) {
    const perms = ROLE_PERMISSIONS[roleCtx.hicsRole] ?? [];
    if (!perms.includes(permission)) continue;
    if (roleCtx.hicsRole === 'SYSTEM_ADMIN') return true;
    if (facilityId && roleCtx.facilityId !== facilityId) continue;
    return true;
  }
  return false;
}
