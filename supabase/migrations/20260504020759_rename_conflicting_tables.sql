/*
  # Rename tables that conflict with Supabase auth schema

  The public.sessions and public.users tables share names with auth.sessions
  and auth.users. Supabase's GoTrue auth server queries these by name and can
  hit the wrong table, causing "Database error querying schema" on login.

  Changes:
  - Rename public.sessions -> public.user_sessions
  - Rename public.users -> public.app_users
  - Update all foreign key references and RLS policies accordingly
  - Update helper functions my_user_id() and user_has_facility_access()
*/

-- Rename the conflicting tables
ALTER TABLE public.sessions RENAME TO user_sessions;
ALTER TABLE public.users RENAME TO app_users;

-- Update foreign key constraint names (they'll still work but rename for clarity)
-- Re-create helper functions pointing to renamed tables

CREATE OR REPLACE FUNCTION user_has_facility_access(fid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users u
    JOIN user_facility_roles ufr ON ufr.user_id = u.id
    WHERE u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND ufr.facility_id = fid
      AND ufr.is_deleted = false
  )
$$;

CREATE OR REPLACE FUNCTION my_user_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM app_users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  LIMIT 1
$$;

-- Drop old RLS policies that reference the old table name and recreate them
-- (policies on the renamed table are automatically moved, but we need to fix
--  the ones on other tables that reference my_user_id() — those still work)

-- Fix RLS policies on app_users (previously users)
DROP POLICY IF EXISTS "Authenticated users can read own user record" ON app_users;
DROP POLICY IF EXISTS "Authenticated users can update own user record" ON app_users;

CREATE POLICY "Authenticated users can read own user record"
  ON app_users FOR SELECT
  TO authenticated
  USING (id = my_user_id());

CREATE POLICY "Authenticated users can update own user record"
  ON app_users FOR UPDATE
  TO authenticated
  USING (id = my_user_id())
  WITH CHECK (id = my_user_id());

-- Fix RLS policies on user_sessions (previously sessions)
DROP POLICY IF EXISTS "Users can read own sessions" ON user_sessions;

CREATE POLICY "Users can read own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (user_id = my_user_id());
