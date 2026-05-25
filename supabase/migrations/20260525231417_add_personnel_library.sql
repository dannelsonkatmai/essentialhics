/*
  # Add Personnel Library

  ## Summary
  Creates a facility-scoped pre-load library for incident personnel. Hospitals can
  populate this directory before any incident occurs, then pull records directly
  into ICS-203 and ICS-207 forms during an incident.

  ## New Tables

  ### facility_personnel
  Stores individual personnel records pre-loaded by a facility.
  - id (uuid, PK)
  - facility_id (uuid, FK → facilities) — scopes record to one facility
  - first_name, last_name (text) — person's name
  - title (text, optional) — job title / organizational title
  - default_hics_role (hics_role enum, optional) — the HICS role this person
    typically fills; used to filter suggestions in forms
  - phone_mobile, phone_work, pager_number (text, optional) — contact details
  - email (text, optional) — work email
  - agency (text, optional) — home agency or department
  - notes (text, optional) — free-text notes
  - is_active (boolean, default true) — soft-disable without deleting
  - is_deleted (boolean, default false) — soft-delete flag
  - created_at, updated_at (timestamptz)

  ### facility_personnel_rosters
  Named groupings of personnel records (e.g. "Day Shift Command Staff").
  - id (uuid, PK)
  - facility_id (uuid, FK → facilities)
  - name (text) — roster name
  - description (text, optional)
  - is_deleted (boolean, default false)
  - created_at, updated_at (timestamptz)

  ### facility_personnel_roster_members
  Junction table linking a personnel record to a roster with an optional
  designated HICS role for that slot.
  - id (uuid, PK)
  - roster_id (uuid, FK → facility_personnel_rosters)
  - personnel_id (uuid, FK → facility_personnel)
  - designated_hics_role (hics_role enum, optional) — role override for this slot
  - sort_order (int, default 0)
  - created_at (timestamptz)

  ## Security
  - RLS enabled on all three tables
  - SELECT: any authenticated user whose facility_id matches can read
  - INSERT/UPDATE/DELETE: restricted to FACILITY_ADMIN and SYSTEM_ADMIN roles
    (enforced via app_metadata check in RLS policies)

  ## Notes
  1. This is the first "pre-load data" table. Future tables (equipment lists,
     communication plans) should follow the same pattern: facility_id FK,
     is_active + is_deleted flags, RLS by facility.
  2. No changes to existing tables.
*/

-- ─────────────────────────────────────────────
-- 1. facility_personnel
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facility_personnel (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id         uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  first_name          text NOT NULL DEFAULT '',
  last_name           text NOT NULL DEFAULT '',
  title               text,
  default_hics_role   hics_role,
  phone_mobile        text,
  phone_work          text,
  pager_number        text,
  email               text,
  agency              text,
  notes               text,
  is_active           boolean NOT NULL DEFAULT true,
  is_deleted          boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facility_personnel_facility_idx
  ON facility_personnel (facility_id)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS facility_personnel_role_idx
  ON facility_personnel (facility_id, default_hics_role)
  WHERE is_deleted = false AND is_active = true;

ALTER TABLE facility_personnel ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own facility's personnel
CREATE POLICY "Facility members can view personnel"
  ON facility_personnel
  FOR SELECT
  TO authenticated
  USING (
    facility_id IN (
      SELECT facility_id FROM user_facility_roles
      WHERE user_id = (
        SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
      )
      AND is_deleted = false
    )
  );

-- Only admins can insert
CREATE POLICY "Admins can insert personnel"
  ON facility_personnel
  FOR INSERT
  TO authenticated
  WITH CHECK (
    facility_id IN (
      SELECT facility_id FROM user_facility_roles
      WHERE user_id = (
        SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
      )
      AND hics_role IN ('FACILITY_ADMIN', 'SYSTEM_ADMIN')
      AND is_deleted = false
    )
  );

-- Only admins can update
CREATE POLICY "Admins can update personnel"
  ON facility_personnel
  FOR UPDATE
  TO authenticated
  USING (
    facility_id IN (
      SELECT facility_id FROM user_facility_roles
      WHERE user_id = (
        SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
      )
      AND hics_role IN ('FACILITY_ADMIN', 'SYSTEM_ADMIN')
      AND is_deleted = false
    )
  )
  WITH CHECK (
    facility_id IN (
      SELECT facility_id FROM user_facility_roles
      WHERE user_id = (
        SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
      )
      AND hics_role IN ('FACILITY_ADMIN', 'SYSTEM_ADMIN')
      AND is_deleted = false
    )
  );

-- Only admins can delete (soft-delete via update, but policy covers hard-delete too)
CREATE POLICY "Admins can delete personnel"
  ON facility_personnel
  FOR DELETE
  TO authenticated
  USING (
    facility_id IN (
      SELECT facility_id FROM user_facility_roles
      WHERE user_id = (
        SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
      )
      AND hics_role IN ('FACILITY_ADMIN', 'SYSTEM_ADMIN')
      AND is_deleted = false
    )
  );

-- ─────────────────────────────────────────────
-- 2. facility_personnel_rosters
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facility_personnel_rosters (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT '',
  description text,
  is_deleted  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facility_personnel_rosters_facility_idx
  ON facility_personnel_rosters (facility_id)
  WHERE is_deleted = false;

ALTER TABLE facility_personnel_rosters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Facility members can view rosters"
  ON facility_personnel_rosters
  FOR SELECT
  TO authenticated
  USING (
    facility_id IN (
      SELECT facility_id FROM user_facility_roles
      WHERE user_id = (
        SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
      )
      AND is_deleted = false
    )
  );

CREATE POLICY "Admins can insert rosters"
  ON facility_personnel_rosters
  FOR INSERT
  TO authenticated
  WITH CHECK (
    facility_id IN (
      SELECT facility_id FROM user_facility_roles
      WHERE user_id = (
        SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
      )
      AND hics_role IN ('FACILITY_ADMIN', 'SYSTEM_ADMIN')
      AND is_deleted = false
    )
  );

CREATE POLICY "Admins can update rosters"
  ON facility_personnel_rosters
  FOR UPDATE
  TO authenticated
  USING (
    facility_id IN (
      SELECT facility_id FROM user_facility_roles
      WHERE user_id = (
        SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
      )
      AND hics_role IN ('FACILITY_ADMIN', 'SYSTEM_ADMIN')
      AND is_deleted = false
    )
  )
  WITH CHECK (
    facility_id IN (
      SELECT facility_id FROM user_facility_roles
      WHERE user_id = (
        SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
      )
      AND hics_role IN ('FACILITY_ADMIN', 'SYSTEM_ADMIN')
      AND is_deleted = false
    )
  );

CREATE POLICY "Admins can delete rosters"
  ON facility_personnel_rosters
  FOR DELETE
  TO authenticated
  USING (
    facility_id IN (
      SELECT facility_id FROM user_facility_roles
      WHERE user_id = (
        SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
      )
      AND hics_role IN ('FACILITY_ADMIN', 'SYSTEM_ADMIN')
      AND is_deleted = false
    )
  );

-- ─────────────────────────────────────────────
-- 3. facility_personnel_roster_members
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facility_personnel_roster_members (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_id             uuid NOT NULL REFERENCES facility_personnel_rosters(id) ON DELETE CASCADE,
  personnel_id          uuid NOT NULL REFERENCES facility_personnel(id) ON DELETE CASCADE,
  designated_hics_role  hics_role,
  sort_order            integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (roster_id, personnel_id)
);

CREATE INDEX IF NOT EXISTS roster_members_roster_idx
  ON facility_personnel_roster_members (roster_id);

ALTER TABLE facility_personnel_roster_members ENABLE ROW LEVEL SECURITY;

-- Members inherit the same facility-scope as the roster
CREATE POLICY "Facility members can view roster members"
  ON facility_personnel_roster_members
  FOR SELECT
  TO authenticated
  USING (
    roster_id IN (
      SELECT id FROM facility_personnel_rosters
      WHERE facility_id IN (
        SELECT facility_id FROM user_facility_roles
        WHERE user_id = (
          SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
        )
        AND is_deleted = false
      )
      AND is_deleted = false
    )
  );

CREATE POLICY "Admins can insert roster members"
  ON facility_personnel_roster_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    roster_id IN (
      SELECT id FROM facility_personnel_rosters
      WHERE facility_id IN (
        SELECT facility_id FROM user_facility_roles
        WHERE user_id = (
          SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
        )
        AND hics_role IN ('FACILITY_ADMIN', 'SYSTEM_ADMIN')
        AND is_deleted = false
      )
      AND is_deleted = false
    )
  );

CREATE POLICY "Admins can update roster members"
  ON facility_personnel_roster_members
  FOR UPDATE
  TO authenticated
  USING (
    roster_id IN (
      SELECT id FROM facility_personnel_rosters
      WHERE facility_id IN (
        SELECT facility_id FROM user_facility_roles
        WHERE user_id = (
          SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
        )
        AND hics_role IN ('FACILITY_ADMIN', 'SYSTEM_ADMIN')
        AND is_deleted = false
      )
      AND is_deleted = false
    )
  )
  WITH CHECK (
    roster_id IN (
      SELECT id FROM facility_personnel_rosters
      WHERE facility_id IN (
        SELECT facility_id FROM user_facility_roles
        WHERE user_id = (
          SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
        )
        AND hics_role IN ('FACILITY_ADMIN', 'SYSTEM_ADMIN')
        AND is_deleted = false
      )
      AND is_deleted = false
    )
  );

CREATE POLICY "Admins can delete roster members"
  ON facility_personnel_roster_members
  FOR DELETE
  TO authenticated
  USING (
    roster_id IN (
      SELECT id FROM facility_personnel_rosters
      WHERE facility_id IN (
        SELECT facility_id FROM user_facility_roles
        WHERE user_id = (
          SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
        )
        AND hics_role IN ('FACILITY_ADMIN', 'SYSTEM_ADMIN')
        AND is_deleted = false
      )
      AND is_deleted = false
    )
  );
