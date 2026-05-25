export type HicsRole =
  | 'SYSTEM_ADMIN' | 'SYSTEM_VIEWER' | 'FACILITY_ADMIN'
  | 'INCIDENT_COMMANDER' | 'DEPUTY_INCIDENT_COMMANDER'
  | 'PUBLIC_INFORMATION_OFFICER' | 'SAFETY_OFFICER' | 'LIAISON_OFFICER'
  | 'MEDICAL_TECHNICAL_SPECIALIST'
  | 'OPERATIONS_SECTION_CHIEF' | 'PLANNING_SECTION_CHIEF'
  | 'LOGISTICS_SECTION_CHIEF' | 'FINANCE_ADMIN_SECTION_CHIEF'
  | 'MEDICAL_CARE_BRANCH_DIRECTOR' | 'INFRASTRUCTURE_BRANCH_DIRECTOR'
  | 'SECURITY_BRANCH_DIRECTOR' | 'BUSINESS_CONTINUITY_BRANCH_DIRECTOR'
  | 'HAZMAT_BRANCH_DIRECTOR' | 'PATIENT_FAMILY_INFORMATION_BRANCH_DIRECTOR'
  | 'RESOURCES_UNIT_LEADER' | 'SITUATION_UNIT_LEADER'
  | 'DOCUMENTATION_UNIT_LEADER' | 'DEMOBILIZATION_UNIT_LEADER'
  | 'SERVICE_BRANCH_DIRECTOR' | 'SUPPORT_BRANCH_DIRECTOR'
  | 'COMMUNICATIONS_UNIT_LEADER' | 'IT_SYSTEMS_UNIT_LEADER'
  | 'STAFF_FOOD_WATER_UNIT_LEADER' | 'TRANSPORTATION_UNIT_LEADER'
  | 'FACILITIES_UNIT_LEADER' | 'SUPPLY_UNIT_LEADER'
  | 'LABOR_POOL_CREDENTIALS_UNIT_LEADER'
  | 'TIME_UNIT_LEADER' | 'PROCUREMENT_UNIT_LEADER'
  | 'COMPENSATION_CLAIMS_UNIT_LEADER' | 'COST_UNIT_LEADER'
  | 'RESPONDER' | 'READ_ONLY_OBSERVER';

export type Permission =
  | 'iap:create' | 'iap:read' | 'iap:edit' | 'iap:approve' | 'iap:publish'
  | 'incident:create' | 'incident:read' | 'incident:close'
  | 'resource:request' | 'resource:approve' | 'resource:assign' | 'resource:read'
  | 'cost:read' | 'cost:edit' | 'cost:approve'
  | 'user:create' | 'user:read' | 'user:edit' | 'user:deactivate'
  | 'facility:read' | 'facility:edit'
  | 'audit_log:read'
  | 'report:read' | 'report:export';

export interface AuthUserRole {
  facilityId: string;
  hicsRole: HicsRole;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  roles?: AuthUserRole[];
  facilityIds?: string[];
  primaryFacilityId?: string;
}

export interface UserFacilityRole {
  id: string;
  facilityId: string;
  hicsRole: HicsRole;
  isPrimaryFacility: boolean;
  assignedAt: string;
  facility?: { name: string; shortName: string };
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  jobTitle?: string;
  employeeId?: string;
  phoneMobile?: string;
  phoneWork?: string;
  pagerNumber?: string;
  authProvider: 'LOCAL' | 'AZURE_AD' | 'OKTA';
  isActive: boolean;
  isLocked: boolean;
  lastLoginAt?: string;
  passwordChangedAt?: string;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  userFacilityRoles: UserFacilityRole[];
  sessions?: Session[];
}

export interface Session {
  id: string;
  deviceInfo?: string;
  ipAddress?: string;
  lastUsedAt: string;
  createdAt: string;
}

export interface Facility {
  id: string;
  name: string;
  shortName: string;
  address: { street: string; city: string; state: string; zip: string };
  phone?: string;
  fax?: string;
  licenseNumber?: string;
  facilityType: 'HOSPITAL' | 'CLINIC' | 'ALTERNATE_CARE_SITE' | 'OTHER';
  isActive: boolean;
  timezone: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  createdAt: string;
  departments?: Department[];
}

export interface Department {
  id: string;
  facilityId: string;
  name: string;
  code: string;
  parentDepartmentId?: string;
  isActive: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorUserId?: string;
  actorIpAddress?: string;
  actorUserAgent?: string;
  facilityId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  metadata?: Record<string, unknown>;
  actorUser?: { id: string; email: string; firstName: string; lastName: string };
  facility?: { id: string; name: string; shortName: string };
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

export interface PersonnelRecord {
  id: string;
  facilityId: string;
  firstName: string;
  lastName: string;
  title?: string;
  defaultHicsRole?: HicsRole;
  phoneMobile?: string;
  phoneWork?: string;
  pagerNumber?: string;
  email?: string;
  agency?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersonnelRosterMember {
  id: string;
  rosterId: string;
  personnelId: string;
  designatedHicsRole?: HicsRole;
  sortOrder: number;
  createdAt: string;
  personnel?: PersonnelRecord;
}

export interface PersonnelRoster {
  id: string;
  facilityId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  members?: PersonnelRosterMember[];
}

export const HICS_ROLE_LABELS: Record<HicsRole, string> = {
  SYSTEM_ADMIN: 'System Administrator',
  SYSTEM_VIEWER: 'System Viewer',
  FACILITY_ADMIN: 'Facility Administrator',
  INCIDENT_COMMANDER: 'Incident Commander',
  DEPUTY_INCIDENT_COMMANDER: 'Deputy Incident Commander',
  PUBLIC_INFORMATION_OFFICER: 'Public Information Officer',
  SAFETY_OFFICER: 'Safety Officer',
  LIAISON_OFFICER: 'Liaison Officer',
  MEDICAL_TECHNICAL_SPECIALIST: 'Medical Technical Specialist',
  OPERATIONS_SECTION_CHIEF: 'Operations Section Chief',
  PLANNING_SECTION_CHIEF: 'Planning Section Chief',
  LOGISTICS_SECTION_CHIEF: 'Logistics Section Chief',
  FINANCE_ADMIN_SECTION_CHIEF: 'Finance/Admin Section Chief',
  MEDICAL_CARE_BRANCH_DIRECTOR: 'Medical Care Branch Director',
  INFRASTRUCTURE_BRANCH_DIRECTOR: 'Infrastructure Branch Director',
  SECURITY_BRANCH_DIRECTOR: 'Security Branch Director',
  BUSINESS_CONTINUITY_BRANCH_DIRECTOR: 'Business Continuity Branch Director',
  HAZMAT_BRANCH_DIRECTOR: 'Hazmat Branch Director',
  PATIENT_FAMILY_INFORMATION_BRANCH_DIRECTOR: 'Patient/Family Info Branch Director',
  RESOURCES_UNIT_LEADER: 'Resources Unit Leader',
  SITUATION_UNIT_LEADER: 'Situation Unit Leader',
  DOCUMENTATION_UNIT_LEADER: 'Documentation Unit Leader',
  DEMOBILIZATION_UNIT_LEADER: 'Demobilization Unit Leader',
  SERVICE_BRANCH_DIRECTOR: 'Service Branch Director',
  SUPPORT_BRANCH_DIRECTOR: 'Support Branch Director',
  COMMUNICATIONS_UNIT_LEADER: 'Communications Unit Leader',
  IT_SYSTEMS_UNIT_LEADER: 'IT Systems Unit Leader',
  STAFF_FOOD_WATER_UNIT_LEADER: 'Staff Food & Water Unit Leader',
  TRANSPORTATION_UNIT_LEADER: 'Transportation Unit Leader',
  FACILITIES_UNIT_LEADER: 'Facilities Unit Leader',
  SUPPLY_UNIT_LEADER: 'Supply Unit Leader',
  LABOR_POOL_CREDENTIALS_UNIT_LEADER: 'Labor Pool & Credentials Unit Leader',
  TIME_UNIT_LEADER: 'Time Unit Leader',
  PROCUREMENT_UNIT_LEADER: 'Procurement Unit Leader',
  COMPENSATION_CLAIMS_UNIT_LEADER: 'Compensation & Claims Unit Leader',
  COST_UNIT_LEADER: 'Cost Unit Leader',
  RESPONDER: 'Responder',
  READ_ONLY_OBSERVER: 'Read-Only Observer',
};
