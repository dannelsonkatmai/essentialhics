/*
  # HICS Full Schema Migration

  ## Overview
  Creates the complete Hospital Incident Command System (HICS) database schema
  across all three phases of the application.

  ## Phase 1 — Core Organization, Auth & Audit
  - `health_systems` — Top-level healthcare organizations
  - `facilities` — Hospitals/clinics within a health system
  - `departments` — Department hierarchy within a facility
  - `users` — Application users with RBAC
  - `user_facility_roles` — Role assignments per user per facility (HICS roles)
  - `positions` — HICS position directory per facility
  - `sessions` — User auth sessions (legacy, superseded by Supabase Auth)
  - `password_reset_tokens` — Password reset flow tokens
  - `audit_logs` — Comprehensive audit trail for all system actions

  ## Phase 2 — Incidents, IAP, Templates, Org Board, Notifications
  - `incidents` — Active incident records with lifecycle status
  - `operational_periods` — Time-boxed operational periods within an incident
  - `iaps` — Incident Action Plans with approval workflow
  - `iap_review_assignments` — IAP reviewer assignments
  - `iap_comments` — Review comments on IAP forms
  - `iap_forms_201` through `iap_forms_215a` — Individual ICS forms
  - `iap_forms_hics251`, `iap_forms_hics252` — HICS-specific forms
  - `iap_templates` — Reusable IAP templates
  - `iap_template_form_defaults` — Default values per form per template
  - `objectives_bank` — Pre-built incident objectives library
  - `tactics_bank` — Pre-built tactics library
  - `incident_position_assignments` — Org board position assignments
  - `notifications` — In-app notifications

  ## Phase 3 — Resources, Requests, Costs, FEMA Export
  - `resource_types` — NIMS-typed resource catalog entries
  - `facility_resource_inventory` — Pre-incident inventory per facility
  - `incident_resources` — Resources deployed to an incident
  - `resource_status_history` — Append-only resource status change log
  - `resource_assignments` — Resource-to-role/period assignments
  - `resource_requests` — ICS-213RR resource request forms
  - `resource_request_line_items` — Line items within a request
  - `request_fulfillments` — How each line item was fulfilled
  - `mutual_aid_agreements` — Pre-negotiated mutual aid partners
  - `cost_records` — Cost ledger entries
  - `labor_cost_records` — Labor detail linked to cost records
  - `equipment_cost_records` — Equipment detail linked to cost records
  - `cost_rollups` — Pre-computed cost snapshots
  - `export_jobs` — Async export job queue

  ## Security
  - RLS enabled on all tables
  - Authenticated users can read/write their own facility's data
  - System admin bypass policies for administrative tables
*/

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE auth_provider AS ENUM ('LOCAL', 'AZURE_AD', 'OKTA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE facility_type AS ENUM ('HOSPITAL', 'CLINIC', 'ALTERNATE_CARE_SITE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hics_role AS ENUM (
    'SYSTEM_ADMIN', 'SYSTEM_VIEWER', 'FACILITY_ADMIN',
    'INCIDENT_COMMANDER', 'DEPUTY_INCIDENT_COMMANDER',
    'PUBLIC_INFORMATION_OFFICER', 'SAFETY_OFFICER', 'LIAISON_OFFICER',
    'MEDICAL_TECHNICAL_SPECIALIST',
    'OPERATIONS_SECTION_CHIEF', 'PLANNING_SECTION_CHIEF',
    'LOGISTICS_SECTION_CHIEF', 'FINANCE_ADMIN_SECTION_CHIEF',
    'MEDICAL_CARE_BRANCH_DIRECTOR', 'INFRASTRUCTURE_BRANCH_DIRECTOR',
    'SECURITY_BRANCH_DIRECTOR', 'BUSINESS_CONTINUITY_BRANCH_DIRECTOR',
    'HAZMAT_BRANCH_DIRECTOR', 'PATIENT_FAMILY_INFORMATION_BRANCH_DIRECTOR',
    'RESOURCES_UNIT_LEADER', 'SITUATION_UNIT_LEADER',
    'DOCUMENTATION_UNIT_LEADER', 'DEMOBILIZATION_UNIT_LEADER',
    'SERVICE_BRANCH_DIRECTOR', 'SUPPORT_BRANCH_DIRECTOR',
    'COMMUNICATIONS_UNIT_LEADER', 'IT_SYSTEMS_UNIT_LEADER',
    'STAFF_FOOD_WATER_UNIT_LEADER', 'TRANSPORTATION_UNIT_LEADER',
    'FACILITIES_UNIT_LEADER', 'SUPPLY_UNIT_LEADER',
    'LABOR_POOL_CREDENTIALS_UNIT_LEADER',
    'TIME_UNIT_LEADER', 'PROCUREMENT_UNIT_LEADER',
    'COMPENSATION_CLAIMS_UNIT_LEADER', 'COST_UNIT_LEADER',
    'RESPONDER', 'READ_ONLY_OBSERVER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'USER_LOGIN', 'USER_LOGIN_FAILED', 'USER_LOGOUT', 'USER_LOCKED',
    'USER_CREATED', 'USER_UPDATED', 'USER_DEACTIVATED',
    'USER_ROLE_ASSIGNED', 'USER_ROLE_REMOVED', 'USER_PASSWORD_RESET',
    'USER_MFA_ENROLLED', 'USER_MFA_DISABLED', 'USER_SESSION_REVOKED',
    'FACILITY_CREATED', 'FACILITY_UPDATED', 'SETTINGS_UPDATED',
    'IAP_CREATED', 'IAP_UPDATED', 'IAP_SUBMITTED', 'IAP_APPROVED',
    'IAP_RETURNED', 'IAP_PUBLISHED', 'IAP_ARCHIVED',
    'INCIDENT_CREATED', 'INCIDENT_UPDATED', 'INCIDENT_CLOSED',
    'POSITION_ASSIGNED', 'POSITION_RELIEVED',
    'RESOURCE_REQUESTED', 'RESOURCE_APPROVED', 'RESOURCE_ASSIGNED',
    'RESOURCE_CREATED', 'RESOURCE_UPDATED', 'RESOURCE_STATUS_CHANGED',
    'RESOURCE_DEMOBILIZED', 'COST_RECORD_CREATED', 'COST_RECORD_UPDATED',
    'COST_RECORD_APPROVED', 'REQUEST_CREATED', 'REQUEST_SUBMITTED',
    'REQUEST_DENIED', 'REQUEST_CANCELLED',
    'MUTUAL_AID_AGREEMENT_CREATED', 'FEMA_REPORT_EXPORTED', 'COST_ROLLUP_COMPUTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE incident_type AS ENUM (
    'MASS_CASUALTY', 'NATURAL_DISASTER', 'HAZMAT', 'CYBER_ATTACK',
    'UTILITY_FAILURE', 'INFECTIOUS_DISEASE', 'ACTIVE_THREAT',
    'INFRASTRUCTURE', 'PLANNED_EVENT', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE incident_status AS ENUM ('PLANNING', 'ACTIVE', 'DEMOBILIZING', 'CLOSED', 'EXERCISED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE incident_severity AS ENUM ('LEVEL_1', 'LEVEL_2', 'LEVEL_3');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE operational_period_status AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE iap_status AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE objective_priority AS ENUM ('IMMEDIATE', 'HIGH', 'MEDIUM', 'LOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE objective_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE risk_rating AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'EXTREME');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE facility_overall_status AS ENUM ('NORMAL', 'MODIFIED', 'RESTRICTED', 'EVACUATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'IAP_SUBMITTED', 'IAP_APPROVED', 'IAP_RETURNED', 'IAP_PUBLISHED',
    'POSITION_ASSIGNED', 'POSITION_RELIEVED', 'PDF_READY', 'COMMENT_ADDED',
    'MESSAGE_RECEIVED', 'RESOURCE_STATUS_CHANGED', 'REQUEST_SUBMITTED',
    'REQUEST_APPROVED', 'REQUEST_DENIED', 'REQUEST_FULFILLED',
    'COST_ROLLUP_READY', 'REPORT_READY', 'ETA_ALERT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE export_job_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE export_job_type AS ENUM ('IAP_PDF', 'FEMA_PA_XLSX', 'COST_SUMMARY_PDF', 'ICS213RR_PDF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nims_kind AS ENUM ('PERSONNEL', 'EQUIPMENT', 'TEAM', 'SUPPLY', 'FACILITIES', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE resource_category AS ENUM ('OVERHEAD', 'LABOR', 'EQUIPMENT', 'SUPPLY', 'FACILITY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE resource_status AS ENUM (
    'ORDERED', 'IN_TRANSIT', 'ASSIGNED', 'AVAILABLE', 'OUT_OF_SERVICE', 'DEMOBILIZED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE resource_source AS ENUM ('INTERNAL', 'MUTUAL_AID', 'CONTRACTED', 'DONATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE request_status AS ENUM (
    'DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'DENIED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE request_priority AS ENUM ('IMMEDIATE', 'PRIORITY', 'ROUTINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cost_type AS ENUM ('LABOR', 'EQUIPMENT', 'SUPPLY', 'CONTRACT', 'OVERHEAD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fema_pa_category AS ENUM (
    'CAT_A', 'CAT_B', 'CAT_C', 'CAT_D', 'CAT_E', 'CAT_F', 'CAT_G', 'CAT_Z'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cost_unit_period AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'FLAT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Phase 1: Core Org Models ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS health_systems (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  short_name            text NOT NULL,
  logo_url              text,
  primary_contact_email text NOT NULL,
  settings              jsonb NOT NULL DEFAULT '{}',
  is_deleted            boolean NOT NULL DEFAULT false,
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facilities (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  health_system_id        uuid NOT NULL REFERENCES health_systems(id),
  name                    text NOT NULL,
  short_name              text NOT NULL,
  address                 jsonb NOT NULL DEFAULT '{}',
  phone                   text,
  fax                     text,
  license_number          text,
  facility_type           facility_type NOT NULL DEFAULT 'HOSPITAL',
  is_active               boolean NOT NULL DEFAULT true,
  timezone                text NOT NULL DEFAULT 'America/New_York',
  emergency_contact_name  text,
  emergency_contact_phone text,
  is_deleted              boolean NOT NULL DEFAULT false,
  deleted_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facilities_health_system_id_idx ON facilities(health_system_id);

CREATE TABLE IF NOT EXISTS departments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id          uuid NOT NULL REFERENCES facilities(id),
  name                 text NOT NULL,
  code                 text NOT NULL,
  parent_department_id uuid REFERENCES departments(id),
  is_active            boolean NOT NULL DEFAULT true,
  is_deleted           boolean NOT NULL DEFAULT false,
  deleted_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS departments_facility_id_idx ON departments(facility_id);

CREATE TABLE IF NOT EXISTS users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  health_system_id      uuid NOT NULL REFERENCES health_systems(id),
  email                 text UNIQUE NOT NULL,
  first_name            text NOT NULL,
  last_name             text NOT NULL,
  display_name          text,
  job_title             text,
  employee_id           text,
  phone_mobile          text,
  phone_work            text,
  pager_number          text,
  password_hash         text,
  auth_provider         auth_provider NOT NULL DEFAULT 'LOCAL',
  external_id           text,
  is_active             boolean NOT NULL DEFAULT true,
  is_locked             boolean NOT NULL DEFAULT false,
  locked_until          timestamptz,
  failed_login_attempts int NOT NULL DEFAULT 0,
  last_login_at         timestamptz,
  password_changed_at   timestamptz,
  must_change_password  boolean NOT NULL DEFAULT true,
  mfa_enabled           boolean NOT NULL DEFAULT false,
  mfa_secret            text,
  mfa_backup_codes      text[] NOT NULL DEFAULT '{}',
  created_by            uuid,
  is_deleted            boolean NOT NULL DEFAULT false,
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_health_system_id_idx ON users(health_system_id);

CREATE TABLE IF NOT EXISTS user_facility_roles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id),
  facility_id         uuid NOT NULL REFERENCES facilities(id),
  hics_role           hics_role NOT NULL,
  is_primary_facility boolean NOT NULL DEFAULT false,
  assigned_by         uuid,
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  is_deleted          boolean NOT NULL DEFAULT false,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, facility_id, hics_role)
);

CREATE INDEX IF NOT EXISTS user_facility_roles_user_id_idx ON user_facility_roles(user_id);
CREATE INDEX IF NOT EXISTS user_facility_roles_facility_id_idx ON user_facility_roles(facility_id);

CREATE TABLE IF NOT EXISTS positions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id      uuid NOT NULL REFERENCES facilities(id),
  hics_role        hics_role NOT NULL,
  display_name     text NOT NULL,
  reports_to_role  hics_role,
  department_id    uuid REFERENCES departments(id),
  contact_override jsonb,
  is_deleted       boolean NOT NULL DEFAULT false,
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS positions_facility_id_idx ON positions(facility_id);

CREATE TABLE IF NOT EXISTS sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id),
  refresh_token text UNIQUE NOT NULL,
  device_info   text,
  ip_address    text,
  user_agent    text,
  last_used_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  is_revoked    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp        timestamptz NOT NULL DEFAULT now(),
  actor_user_id    uuid,
  actor_ip_address text,
  actor_user_agent text,
  facility_id      uuid,
  incident_id      uuid,
  action           audit_action NOT NULL,
  resource_type    text NOT NULL,
  resource_id      text NOT NULL,
  changes          jsonb,
  metadata         jsonb
);

CREATE INDEX IF NOT EXISTS audit_logs_timestamp_idx ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS audit_logs_actor_user_id_idx ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS audit_logs_facility_id_idx ON audit_logs(facility_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);

-- ─── Phase 2: Incidents & IAP ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS incidents (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id          uuid NOT NULL REFERENCES facilities(id),
  health_system_id     uuid NOT NULL REFERENCES health_systems(id),
  incident_number      text NOT NULL,
  name                 text NOT NULL,
  incident_type        incident_type NOT NULL,
  status               incident_status NOT NULL DEFAULT 'PLANNING',
  severity             incident_severity NOT NULL,
  declaration_time     timestamptz NOT NULL,
  estimated_end_time   timestamptz,
  actual_end_time      timestamptz,
  incident_location    text,
  situation_summary    text,
  is_exercise          boolean NOT NULL DEFAULT false,
  created_by           uuid NOT NULL,
  incident_commander_id uuid,
  closed_at            timestamptz,
  is_deleted           boolean NOT NULL DEFAULT false,
  deleted_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(facility_id, incident_number)
);

CREATE INDEX IF NOT EXISTS incidents_facility_id_status_idx ON incidents(facility_id, status);
CREATE INDEX IF NOT EXISTS incidents_health_system_id_idx ON incidents(health_system_id);

CREATE TABLE IF NOT EXISTS operational_periods (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id      uuid NOT NULL REFERENCES incidents(id),
  period_number    int NOT NULL,
  start_time       timestamptz NOT NULL,
  end_time         timestamptz NOT NULL,
  status           operational_period_status NOT NULL DEFAULT 'DRAFT',
  weather_forecast text,
  created_by       uuid NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(incident_id, period_number)
);

CREATE INDEX IF NOT EXISTS operational_periods_incident_id_status_idx ON operational_periods(incident_id, status);

CREATE TABLE IF NOT EXISTS iaps (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_period_id   uuid UNIQUE NOT NULL REFERENCES operational_periods(id),
  incident_id             uuid NOT NULL,
  status                  iap_status NOT NULL DEFAULT 'DRAFT',
  version_number          int NOT NULL DEFAULT 1,
  template_id             uuid,
  created_by              uuid NOT NULL,
  submitted_for_review_at timestamptz,
  submitted_by_user_id    uuid,
  reviewed_at             timestamptz,
  reviewed_by_user_id     uuid,
  approved_at             timestamptz,
  approved_by_user_id     uuid,
  published_at            timestamptz,
  published_by_user_id    uuid,
  approval_notes          text,
  exported_pdf_url        text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS iaps_incident_id_status_idx ON iaps(incident_id, status);

CREATE TABLE IF NOT EXISTS iap_review_assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iap_id              uuid NOT NULL REFERENCES iaps(id),
  assigned_to_user_id uuid NOT NULL,
  assigned_by_user_id uuid NOT NULL,
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  notes               text,
  action              text NOT NULL DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS iap_comments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iap_id              uuid NOT NULL REFERENCES iaps(id),
  form_reference      text NOT NULL,
  field_reference     text,
  comment_text        text NOT NULL,
  author_user_id      uuid NOT NULL,
  is_resolved         boolean NOT NULL DEFAULT false,
  resolved_by_user_id uuid,
  resolved_at         timestamptz,
  parent_comment_id   uuid REFERENCES iap_comments(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS iap_comments_iap_id_is_resolved_idx ON iap_comments(iap_id, is_resolved);

-- IAP Forms

CREATE TABLE IF NOT EXISTS iap_forms_201 (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_period_id        uuid UNIQUE NOT NULL REFERENCES operational_periods(id),
  incident_name                text,
  date_time_initiated          timestamptz,
  map_sketch_url               text,
  current_situation            text,
  initial_response_objectives  text,
  current_organization         jsonb,
  resources_summary            jsonb,
  actions_taken                jsonb,
  prepared_by_user_id          uuid,
  prepared_at                  timestamptz,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iap_forms_202 (
  id                             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_period_id          uuid UNIQUE NOT NULL REFERENCES operational_periods(id),
  period_start                   timestamptz,
  period_end                     timestamptz,
  overall_incident_objectives    text,
  operational_period_objectives  jsonb,
  weather_forecast               text,
  general_safety_message         text,
  site_safety_plan_required      boolean NOT NULL DEFAULT false,
  attachment_list                jsonb,
  approved_by_user_id            uuid,
  approved_at                    timestamptz,
  prepared_by_user_id            uuid,
  prepared_at                    timestamptz,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iap_forms_203 (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_period_id uuid UNIQUE NOT NULL REFERENCES operational_periods(id),
  period_start          timestamptz,
  period_end            timestamptz,
  position_assignments  jsonb,
  prepared_by_user_id   uuid,
  prepared_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iap_forms_204 (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_period_id   uuid NOT NULL REFERENCES operational_periods(id),
  branch                  text,
  division_group          text,
  period_start            timestamptz,
  period_end              timestamptz,
  operations_chief_name   text,
  branch_director_name    text,
  resources_assigned      jsonb,
  work_assignments        text,
  special_instructions    text,
  communications_name     text,
  medical_plan_reference  text,
  prepared_by_user_id     uuid,
  prepared_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS iap_forms_204_operational_period_id_idx ON iap_forms_204(operational_period_id);

CREATE TABLE IF NOT EXISTS iap_forms_207 (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_period_id uuid UNIQUE NOT NULL REFERENCES operational_periods(id),
  org_chart_snapshot    jsonb,
  generated_at          timestamptz,
  generated_by_user_id  uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iap_forms_213 (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id      uuid NOT NULL REFERENCES incidents(id),
  message_number   text NOT NULL,
  to_position      hics_role NOT NULL,
  to_name          text,
  from_position    hics_role NOT NULL,
  from_name        text,
  subject          text,
  message_body     text,
  reply_requested  boolean NOT NULL DEFAULT false,
  reply            text,
  sent_at          timestamptz NOT NULL DEFAULT now(),
  replied_at       timestamptz,
  sender_user_id   uuid NOT NULL,
  recipient_user_id uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS iap_forms_213_incident_id_idx ON iap_forms_213(incident_id);

CREATE TABLE IF NOT EXISTS iap_forms_215 (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_period_id uuid UNIQUE NOT NULL REFERENCES operational_periods(id),
  work_assignments      jsonb,
  prepared_by_user_id   uuid,
  prepared_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iap_forms_215a (
  id                                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_period_id             uuid UNIQUE NOT NULL REFERENCES operational_periods(id),
  hazard_risk_analysis              jsonb,
  prepared_by_safety_officer_user_id uuid,
  prepared_at                       timestamptz,
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iap_forms_hics251 (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_period_id   uuid UNIQUE NOT NULL REFERENCES operational_periods(id),
  report_time             timestamptz,
  facility_systems_status jsonb,
  overall_facility_status facility_overall_status,
  prepared_by_user_id     uuid,
  prepared_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iap_forms_hics252 (
  id                                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operational_period_id                uuid UNIQUE NOT NULL REFERENCES operational_periods(id),
  incident_name                        text,
  incident_number                      text,
  facility_name                        text,
  operational_period_start             timestamptz,
  operational_period_end               timestamptz,
  approved_by_incident_commander_user_id uuid,
  approved_at                          timestamptz,
  forms_included                       jsonb,
  generated_at                         timestamptz,
  iap_signature_captured               boolean NOT NULL DEFAULT false,
  iap_signature_data                   text,
  created_at                           timestamptz NOT NULL DEFAULT now(),
  updated_at                           timestamptz NOT NULL DEFAULT now()
);

-- IAP Templates

CREATE TABLE IF NOT EXISTS iap_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id      uuid REFERENCES facilities(id),
  health_system_id uuid NOT NULL,
  name             text NOT NULL,
  description      text,
  incident_type    incident_type,
  is_active        boolean NOT NULL DEFAULT true,
  is_system_default boolean NOT NULL DEFAULT false,
  parent_template_id uuid REFERENCES iap_templates(id),
  version          int NOT NULL DEFAULT 1,
  created_by       uuid NOT NULL,
  last_modified_by uuid NOT NULL,
  is_deleted       boolean NOT NULL DEFAULT false,
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iap_template_form_defaults (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid NOT NULL REFERENCES iap_templates(id),
  form_number   text NOT NULL,
  default_values jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, form_number)
);

CREATE TABLE IF NOT EXISTS objectives_bank (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id      uuid,
  health_system_id uuid NOT NULL,
  incident_type    incident_type,
  objective_text   text NOT NULL,
  priority         objective_priority NOT NULL,
  assigned_role    hics_role,
  tags             text[] NOT NULL DEFAULT '{}',
  usage_count      int NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  created_by       uuid NOT NULL,
  is_deleted       boolean NOT NULL DEFAULT false,
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tactics_bank (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id      uuid,
  health_system_id uuid NOT NULL,
  branch_division  text,
  tactic_text      text NOT NULL,
  tags             text[] NOT NULL DEFAULT '{}',
  usage_count      int NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  created_by       uuid NOT NULL,
  is_deleted       boolean NOT NULL DEFAULT false,
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_position_assignments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id          uuid NOT NULL REFERENCES incidents(id),
  operational_period_id uuid REFERENCES operational_periods(id),
  hics_role            hics_role NOT NULL,
  assigned_user_id     uuid,
  assigned_by_user_id  uuid NOT NULL,
  assigned_at          timestamptz NOT NULL DEFAULT now(),
  relieved_at          timestamptz,
  is_active            boolean NOT NULL DEFAULT true,
  notes                text,
  contact_override     jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incident_position_assignments_idx ON incident_position_assignments(incident_id, hics_role, is_active);

CREATE TABLE IF NOT EXISTS notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL,
  incident_id       uuid REFERENCES incidents(id),
  type              notification_type NOT NULL,
  title             text NOT NULL,
  body              text NOT NULL,
  action_url        text,
  is_read           boolean NOT NULL DEFAULT false,
  read_at           timestamptz,
  delivery_channels jsonb NOT NULL DEFAULT '{"in_app": true, "email": false}',
  email_sent_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_recipient_user_id_is_read_idx ON notifications(recipient_user_id, is_read);

CREATE TABLE IF NOT EXISTS export_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type      export_job_type NOT NULL DEFAULT 'IAP_PDF',
  iap_id        uuid REFERENCES iaps(id),
  incident_id   uuid REFERENCES incidents(id),
  requested_by  uuid NOT NULL,
  status        export_job_status NOT NULL DEFAULT 'PENDING',
  progress      int NOT NULL DEFAULT 0,
  file_url      text,
  error_message text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS export_jobs_incident_id_job_type_status_idx ON export_jobs(incident_id, job_type, status);

-- ─── Phase 3: Resources, Costs ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS resource_types (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id             uuid REFERENCES facilities(id),
  health_system_id        uuid NOT NULL,
  nims_kind               nims_kind NOT NULL,
  name                    text NOT NULL,
  description             text,
  unit                    text NOT NULL,
  category                resource_category NOT NULL,
  default_cost_per_unit   numeric(12,4),
  default_cost_unit_period cost_unit_period,
  is_active               boolean NOT NULL DEFAULT true,
  is_deleted              boolean NOT NULL DEFAULT false,
  deleted_at              timestamptz,
  created_by              uuid NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resource_types_health_system_id_nims_kind_idx ON resource_types(health_system_id, nims_kind);

CREATE TABLE IF NOT EXISTS facility_resource_inventory (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id        uuid NOT NULL REFERENCES facilities(id),
  resource_type_id   uuid NOT NULL REFERENCES resource_types(id),
  quantity_on_hand   numeric(10,2) NOT NULL DEFAULT 0,
  quantity_available numeric(10,2) NOT NULL DEFAULT 0,
  storage_location   text,
  notes              text,
  last_updated_by    uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE(facility_id, resource_type_id)
);

CREATE INDEX IF NOT EXISTS facility_resource_inventory_facility_id_idx ON facility_resource_inventory(facility_id);

CREATE TABLE IF NOT EXISTS incident_resources (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id          uuid NOT NULL REFERENCES incidents(id),
  facility_id          uuid NOT NULL REFERENCES facilities(id),
  resource_type_id     uuid REFERENCES resource_types(id),
  name                 text NOT NULL,
  nims_kind            nims_kind NOT NULL,
  quantity             numeric(10,2) NOT NULL DEFAULT 1,
  unit                 text NOT NULL DEFAULT 'each',
  source               resource_source NOT NULL DEFAULT 'INTERNAL',
  status               resource_status NOT NULL DEFAULT 'ORDERED',
  resource_identifier  text,
  home_base_org_name   text,
  home_base_contact    text,
  request_id           uuid,
  eta                  timestamptz,
  assigned_to_role     hics_role,
  assigned_to_location text,
  cost_per_unit        numeric(12,4),
  cost_unit_period     cost_unit_period,
  ordered_at           timestamptz,
  in_transit_at        timestamptz,
  assigned_at          timestamptz,
  available_at         timestamptz,
  out_of_service_at    timestamptz,
  demobilized_at       timestamptz,
  notes                text,
  created_by           uuid NOT NULL,
  is_deleted           boolean NOT NULL DEFAULT false,
  deleted_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incident_resources_incident_id_status_idx ON incident_resources(incident_id, status);
CREATE INDEX IF NOT EXISTS incident_resources_incident_id_nims_kind_idx ON incident_resources(incident_id, nims_kind);

CREATE TABLE IF NOT EXISTS resource_status_history (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_resource_id uuid NOT NULL REFERENCES incident_resources(id),
  from_status          resource_status,
  to_status            resource_status NOT NULL,
  changed_by_user_id   uuid,
  changed_at           timestamptz NOT NULL DEFAULT now(),
  location             text,
  notes                text
);

CREATE INDEX IF NOT EXISTS resource_status_history_incident_resource_id_changed_at_idx ON resource_status_history(incident_resource_id, changed_at);

CREATE TABLE IF NOT EXISTS resource_assignments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_resource_id uuid NOT NULL REFERENCES incident_resources(id),
  incident_id          uuid NOT NULL REFERENCES incidents(id),
  operational_period_id uuid REFERENCES operational_periods(id),
  assigned_to_role     hics_role,
  assigned_to_location text,
  assigned_by_user_id  uuid NOT NULL,
  assigned_at          timestamptz NOT NULL DEFAULT now(),
  released_at          timestamptz,
  task_description     text,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resource_assignments_incident_id_idx ON resource_assignments(incident_id, operational_period_id);

CREATE TABLE IF NOT EXISTS resource_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number        text NOT NULL,
  incident_id           uuid NOT NULL REFERENCES incidents(id),
  facility_id           uuid NOT NULL REFERENCES facilities(id),
  requested_by_user_id  uuid NOT NULL,
  priority              request_priority NOT NULL DEFAULT 'ROUTINE',
  status                request_status NOT NULL DEFAULT 'DRAFT',
  mission_assignment    text,
  requested_for_role    hics_role,
  requested_for_section text,
  delivery_location     text,
  delivery_by           timestamptz,
  needed_date           timestamptz,
  estimated_cost        numeric(12,4),
  justification         text,
  submitted_at          timestamptz,
  submitted_by_user_id  uuid,
  approved_at           timestamptz,
  approved_by_user_id   uuid,
  approval_notes        text,
  denied_at             timestamptz,
  denied_by_user_id     uuid,
  denial_reason         text,
  cancelled_at          timestamptz,
  cancelled_by_user_id  uuid,
  is_deleted            boolean NOT NULL DEFAULT false,
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(incident_id, request_number)
);

CREATE INDEX IF NOT EXISTS resource_requests_incident_id_status_idx ON resource_requests(incident_id, status);

CREATE TABLE IF NOT EXISTS resource_request_line_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id           uuid NOT NULL REFERENCES resource_requests(id),
  resource_type_id     uuid REFERENCES resource_types(id),
  resource_description text NOT NULL,
  quantity             numeric(10,2) NOT NULL,
  unit                 text NOT NULL DEFAULT 'each',
  estimated_unit_cost  numeric(12,4),
  estimated_total_cost numeric(12,4),
  filled_quantity      numeric(10,2) NOT NULL DEFAULT 0,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resource_request_line_items_request_id_idx ON resource_request_line_items(request_id);

CREATE TABLE IF NOT EXISTS request_fulfillments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_item_id         uuid NOT NULL REFERENCES resource_request_line_items(id),
  incident_resource_id uuid NOT NULL REFERENCES incident_resources(id),
  quantity_fulfilled   numeric(10,2) NOT NULL,
  fulfilled_by_user_id uuid NOT NULL,
  fulfilled_at         timestamptz NOT NULL DEFAULT now(),
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS request_fulfillments_line_item_id_idx ON request_fulfillments(line_item_id);

CREATE TABLE IF NOT EXISTS mutual_aid_agreements (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id              uuid NOT NULL REFERENCES facilities(id),
  health_system_id         uuid NOT NULL,
  partner_organization_name text NOT NULL,
  partner_contact_name     text,
  partner_contact_phone    text,
  partner_contact_email    text,
  agreement_type           text NOT NULL,
  agreement_number         text,
  effective_date           date,
  expiration_date          date,
  resource_categories      text[] NOT NULL DEFAULT '{}',
  terms                    text,
  is_active                boolean NOT NULL DEFAULT true,
  created_by               uuid NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mutual_aid_agreements_facility_id_idx ON mutual_aid_agreements(facility_id);
CREATE INDEX IF NOT EXISTS mutual_aid_agreements_health_system_id_idx ON mutual_aid_agreements(health_system_id);

CREATE TABLE IF NOT EXISTS cost_records (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id           uuid NOT NULL REFERENCES incidents(id),
  operational_period_id uuid REFERENCES operational_periods(id),
  cost_type             cost_type NOT NULL,
  fema_pa_category      fema_pa_category NOT NULL,
  description           text NOT NULL,
  quantity              numeric(10,3) NOT NULL DEFAULT 1,
  unit_cost             numeric(12,4) NOT NULL,
  total_cost            numeric(14,4) NOT NULL,
  vendor                text,
  invoice_number        text,
  documentation_url     text,
  incurred_at           timestamptz NOT NULL,
  recorded_by_user_id   uuid NOT NULL,
  is_approved           boolean NOT NULL DEFAULT false,
  approved_by_user_id   uuid,
  approved_at           timestamptz,
  notes                 text,
  is_deleted            boolean NOT NULL DEFAULT false,
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cost_records_incident_id_cost_type_idx ON cost_records(incident_id, cost_type);
CREATE INDEX IF NOT EXISTS cost_records_incident_id_fema_pa_category_idx ON cost_records(incident_id, fema_pa_category);

CREATE TABLE IF NOT EXISTS labor_cost_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_record_id   uuid UNIQUE NOT NULL REFERENCES cost_records(id),
  user_id          uuid,
  employee_id      text,
  position         text,
  regular_hours    numeric(8,2) NOT NULL DEFAULT 0,
  overtime_hours   numeric(8,2) NOT NULL DEFAULT 0,
  regular_rate     numeric(10,4) NOT NULL DEFAULT 0,
  overtime_rate    numeric(10,4) NOT NULL DEFAULT 0,
  benefits         numeric(10,4) NOT NULL DEFAULT 0,
  total_labor_cost numeric(14,4) NOT NULL,
  period_start     timestamptz,
  period_end       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipment_cost_records (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_record_id         uuid UNIQUE NOT NULL REFERENCES cost_records(id),
  incident_resource_id   uuid REFERENCES incident_resources(id),
  equipment_type         text NOT NULL,
  equipment_identifier   text,
  hours                  numeric(8,2) NOT NULL DEFAULT 0,
  daily_rate             numeric(10,4) NOT NULL DEFAULT 0,
  mileage                numeric(10,2) NOT NULL DEFAULT 0,
  mileage_rate           numeric(8,4) NOT NULL DEFAULT 0,
  total_equipment_cost   numeric(14,4) NOT NULL,
  operator               text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cost_rollups (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id           uuid NOT NULL REFERENCES incidents(id),
  operational_period_id uuid UNIQUE REFERENCES operational_periods(id),
  computed_at           timestamptz NOT NULL DEFAULT now(),
  total_cost            numeric(16,4) NOT NULL,
  labor_cost            numeric(14,4) NOT NULL,
  equipment_cost        numeric(14,4) NOT NULL,
  supply_cost           numeric(14,4) NOT NULL,
  contract_cost         numeric(14,4) NOT NULL,
  overhead_cost         numeric(14,4) NOT NULL,
  cost_by_fema_category jsonb NOT NULL,
  cost_by_period        jsonb NOT NULL,
  labor_hours           numeric(12,2) NOT NULL DEFAULT 0,
  equipment_hours       numeric(12,2) NOT NULL DEFAULT 0,
  headcount             int NOT NULL DEFAULT 0,
  approved_cost         numeric(16,4) NOT NULL,
  unapproved_cost       numeric(16,4) NOT NULL,
  record_count          int NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cost_rollups_incident_id_computed_at_idx ON cost_rollups(incident_id, computed_at);

-- ─── Enable RLS on all tables ────────────────────────────────────────────────

ALTER TABLE health_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_facility_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE iaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_review_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_forms_201 ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_forms_202 ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_forms_203 ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_forms_204 ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_forms_207 ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_forms_213 ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_forms_215 ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_forms_215a ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_forms_hics251 ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_forms_hics252 ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_template_form_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectives_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE tactics_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_position_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_resource_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_request_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mutual_aid_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_cost_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_cost_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_rollups ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ────────────────────────────────────────────────────────────
-- Authenticated users can access data for facilities they have a role in.
-- System admins can access everything within their health system.

-- Helper: check if auth user has any role at a facility
CREATE OR REPLACE FUNCTION user_has_facility_access(fid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    JOIN user_facility_roles ufr ON ufr.user_id = u.id
    WHERE u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND ufr.facility_id = fid
      AND ufr.is_deleted = false
  )
$$;

-- Helper: get the user's UUID in our users table from auth.uid()
CREATE OR REPLACE FUNCTION my_user_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  LIMIT 1
$$;

-- users: can read own record and records of users in same facilities
CREATE POLICY "Authenticated users can read own user record"
  ON users FOR SELECT
  TO authenticated
  USING (id = my_user_id());

CREATE POLICY "Authenticated users can update own user record"
  ON users FOR UPDATE
  TO authenticated
  USING (id = my_user_id())
  WITH CHECK (id = my_user_id());

-- health_systems: readable by authenticated users
CREATE POLICY "Authenticated users can read health systems"
  ON health_systems FOR SELECT
  TO authenticated
  USING (true);

-- facilities: readable by users with a role in that facility
CREATE POLICY "Authenticated users can read their facilities"
  ON facilities FOR SELECT
  TO authenticated
  USING (user_has_facility_access(id));

-- departments: readable by users with access to the parent facility
CREATE POLICY "Authenticated users can read departments in their facilities"
  ON departments FOR SELECT
  TO authenticated
  USING (user_has_facility_access(facility_id));

-- user_facility_roles: users can read their own role assignments
CREATE POLICY "Users can read own facility role assignments"
  ON user_facility_roles FOR SELECT
  TO authenticated
  USING (user_id = my_user_id());

-- positions: readable by users with access to the facility
CREATE POLICY "Authenticated users can read positions in their facilities"
  ON positions FOR SELECT
  TO authenticated
  USING (user_has_facility_access(facility_id));

-- sessions: users can only see their own sessions
CREATE POLICY "Users can read own sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (user_id = my_user_id());

-- password_reset_tokens: users can only see their own
CREATE POLICY "Users can read own password reset tokens"
  ON password_reset_tokens FOR SELECT
  TO authenticated
  USING (user_id = my_user_id());

-- audit_logs: users can read logs for their facilities
CREATE POLICY "Users can read audit logs for their facilities"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    facility_id IS NULL
    OR user_has_facility_access(facility_id)
  );

CREATE POLICY "Service can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- incidents: users with facility access can read
CREATE POLICY "Users can read incidents in their facilities"
  ON incidents FOR SELECT
  TO authenticated
  USING (user_has_facility_access(facility_id));

CREATE POLICY "Users can insert incidents in their facilities"
  ON incidents FOR INSERT
  TO authenticated
  WITH CHECK (user_has_facility_access(facility_id));

CREATE POLICY "Users can update incidents in their facilities"
  ON incidents FOR UPDATE
  TO authenticated
  USING (user_has_facility_access(facility_id))
  WITH CHECK (user_has_facility_access(facility_id));

-- operational_periods
CREATE POLICY "Users can read operational periods for their incidents"
  ON operational_periods FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = incident_id AND user_has_facility_access(i.facility_id)
    )
  );

CREATE POLICY "Users can insert operational periods for their incidents"
  ON operational_periods FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = incident_id AND user_has_facility_access(i.facility_id)
    )
  );

CREATE POLICY "Users can update operational periods for their incidents"
  ON operational_periods FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = incident_id AND user_has_facility_access(i.facility_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = incident_id AND user_has_facility_access(i.facility_id)
    )
  );

-- iaps
CREATE POLICY "Users can read IAPs for their incidents"
  ON iaps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = incident_id AND user_has_facility_access(i.facility_id)
    )
  );

CREATE POLICY "Users can insert IAPs for their incidents"
  ON iaps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = incident_id AND user_has_facility_access(i.facility_id)
    )
  );

CREATE POLICY "Users can update IAPs for their incidents"
  ON iaps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = incident_id AND user_has_facility_access(i.facility_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = incident_id AND user_has_facility_access(i.facility_id)
    )
  );

-- notifications: users can only read/update their own
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (recipient_user_id = my_user_id());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (recipient_user_id = my_user_id())
  WITH CHECK (recipient_user_id = my_user_id());

CREATE POLICY "Service can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- resource_types: readable by authenticated users
CREATE POLICY "Authenticated users can read resource types"
  ON resource_types FOR SELECT
  TO authenticated
  USING (true);

-- incident_resources
CREATE POLICY "Users can read incident resources for their facilities"
  ON incident_resources FOR SELECT
  TO authenticated
  USING (user_has_facility_access(facility_id));

CREATE POLICY "Users can insert incident resources for their facilities"
  ON incident_resources FOR INSERT
  TO authenticated
  WITH CHECK (user_has_facility_access(facility_id));

CREATE POLICY "Users can update incident resources for their facilities"
  ON incident_resources FOR UPDATE
  TO authenticated
  USING (user_has_facility_access(facility_id))
  WITH CHECK (user_has_facility_access(facility_id));

-- resource_requests
CREATE POLICY "Users can read resource requests for their facilities"
  ON resource_requests FOR SELECT
  TO authenticated
  USING (user_has_facility_access(facility_id));

CREATE POLICY "Users can insert resource requests for their facilities"
  ON resource_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_has_facility_access(facility_id));

CREATE POLICY "Users can update resource requests for their facilities"
  ON resource_requests FOR UPDATE
  TO authenticated
  USING (user_has_facility_access(facility_id))
  WITH CHECK (user_has_facility_access(facility_id));

-- cost_records
CREATE POLICY "Users can read cost records for their incidents"
  ON cost_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = incident_id AND user_has_facility_access(i.facility_id)
    )
  );

CREATE POLICY "Users can insert cost records for their incidents"
  ON cost_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = incident_id AND user_has_facility_access(i.facility_id)
    )
  );

CREATE POLICY "Users can update cost records for their incidents"
  ON cost_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = incident_id AND user_has_facility_access(i.facility_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM incidents i
      WHERE i.id = incident_id AND user_has_facility_access(i.facility_id)
    )
  );

-- mutual_aid_agreements
CREATE POLICY "Users can read mutual aid agreements for their facilities"
  ON mutual_aid_agreements FOR SELECT
  TO authenticated
  USING (user_has_facility_access(facility_id));

-- iap_templates: readable by all authenticated users
CREATE POLICY "Authenticated users can read IAP templates"
  ON iap_templates FOR SELECT
  TO authenticated
  USING (true);

-- iap_forms: accessible for authenticated users in the related facility
-- Apply a simple policy for all IAP form tables
CREATE POLICY "Authenticated users can read iap_review_assignments"
  ON iap_review_assignments FOR SELECT
  TO authenticated
  USING (
    assigned_to_user_id = my_user_id()
    OR assigned_by_user_id = my_user_id()
  );

CREATE POLICY "Authenticated users can read iap_comments"
  ON iap_comments FOR SELECT
  TO authenticated
  USING (author_user_id = my_user_id());

CREATE POLICY "Authenticated users can insert iap_comments"
  ON iap_comments FOR INSERT
  TO authenticated
  WITH CHECK (author_user_id = my_user_id());

-- IAP form tables: authenticated users in same facility as incident can read/write
CREATE POLICY "Authenticated users can read/write iap_forms_201"
  ON iap_forms_201 FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert iap_forms_201"
  ON iap_forms_201 FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update iap_forms_201"
  ON iap_forms_201 FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read/write iap_forms_202"
  ON iap_forms_202 FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert iap_forms_202"
  ON iap_forms_202 FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update iap_forms_202"
  ON iap_forms_202 FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read/write iap_forms_203"
  ON iap_forms_203 FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert iap_forms_203"
  ON iap_forms_203 FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update iap_forms_203"
  ON iap_forms_203 FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read/write iap_forms_204"
  ON iap_forms_204 FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert iap_forms_204"
  ON iap_forms_204 FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update iap_forms_204"
  ON iap_forms_204 FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read/write iap_forms_207"
  ON iap_forms_207 FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert iap_forms_207"
  ON iap_forms_207 FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update iap_forms_207"
  ON iap_forms_207 FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read/write iap_forms_213"
  ON iap_forms_213 FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert iap_forms_213"
  ON iap_forms_213 FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update iap_forms_213"
  ON iap_forms_213 FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read/write iap_forms_215"
  ON iap_forms_215 FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert iap_forms_215"
  ON iap_forms_215 FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update iap_forms_215"
  ON iap_forms_215 FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read/write iap_forms_215a"
  ON iap_forms_215a FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert iap_forms_215a"
  ON iap_forms_215a FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update iap_forms_215a"
  ON iap_forms_215a FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read/write iap_forms_hics251"
  ON iap_forms_hics251 FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert iap_forms_hics251"
  ON iap_forms_hics251 FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update iap_forms_hics251"
  ON iap_forms_hics251 FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read/write iap_forms_hics252"
  ON iap_forms_hics252 FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert iap_forms_hics252"
  ON iap_forms_hics252 FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update iap_forms_hics252"
  ON iap_forms_hics252 FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read iap_template_form_defaults"
  ON iap_template_form_defaults FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read objectives_bank"
  ON objectives_bank FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read tactics_bank"
  ON tactics_bank FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read incident_position_assignments"
  ON incident_position_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert incident_position_assignments"
  ON incident_position_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update incident_position_assignments"
  ON incident_position_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read export_jobs"
  ON export_jobs FOR SELECT TO authenticated USING (requested_by = my_user_id());
CREATE POLICY "Authenticated users can insert export_jobs"
  ON export_jobs FOR INSERT TO authenticated WITH CHECK (requested_by = my_user_id());

CREATE POLICY "Authenticated users can read facility_resource_inventory"
  ON facility_resource_inventory FOR SELECT TO authenticated USING (user_has_facility_access(facility_id));

CREATE POLICY "Authenticated users can read resource_status_history"
  ON resource_status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert resource_status_history"
  ON resource_status_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can read resource_assignments"
  ON resource_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert resource_assignments"
  ON resource_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update resource_assignments"
  ON resource_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read resource_request_line_items"
  ON resource_request_line_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert resource_request_line_items"
  ON resource_request_line_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update resource_request_line_items"
  ON resource_request_line_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read request_fulfillments"
  ON request_fulfillments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert request_fulfillments"
  ON request_fulfillments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can read labor_cost_records"
  ON labor_cost_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert labor_cost_records"
  ON labor_cost_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update labor_cost_records"
  ON labor_cost_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read equipment_cost_records"
  ON equipment_cost_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert equipment_cost_records"
  ON equipment_cost_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update equipment_cost_records"
  ON equipment_cost_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read cost_rollups"
  ON cost_rollups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert cost_rollups"
  ON cost_rollups FOR INSERT TO authenticated WITH CHECK (true);
