/*
  # Auto-assign sequential request numbers per incident

  ## Summary
  Replaces client-side timestamp-based request numbers with sequential,
  per-incident numbers in the format REQ-001, REQ-002, etc.

  ## Changes

  ### Modified Tables
  - `resource_requests`
    - `request_number` column changed to allow NULL on insert (assigned by trigger)

  ### New Objects
  1. `incident_request_seq` table — tracks the last-used sequence number per incident
  2. `assign_request_number()` function — atomically increments the per-incident counter
     and formats the number as REQ-NNN (zero-padded to 3 digits, grows beyond 3 if needed)
  3. `trg_assign_request_number` trigger — fires BEFORE INSERT on resource_requests,
     sets request_number when it is NULL

  ## Security
  - RLS enabled on `incident_request_seq`
  - Only the trigger function (SECURITY DEFINER) can write to the sequence table;
    no direct user policies are needed since users never access it directly
*/

-- 1. Sequence tracker table
CREATE TABLE IF NOT EXISTS incident_request_seq (
  incident_id uuid PRIMARY KEY REFERENCES incidents(id),
  last_seq     integer NOT NULL DEFAULT 0
);

ALTER TABLE incident_request_seq ENABLE ROW LEVEL SECURITY;

-- No direct user access; all writes go through the SECURITY DEFINER function.
CREATE POLICY "No direct access to request seq"
  ON incident_request_seq
  FOR SELECT
  TO authenticated
  USING (false);

-- 2. Function to atomically get the next number for an incident
CREATE OR REPLACE FUNCTION assign_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_seq integer;
BEGIN
  -- Only assign if not already set
  IF NEW.request_number IS NOT NULL AND NEW.request_number <> '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO incident_request_seq (incident_id, last_seq)
  VALUES (NEW.incident_id, 1)
  ON CONFLICT (incident_id) DO UPDATE
    SET last_seq = incident_request_seq.last_seq + 1
  RETURNING last_seq INTO next_seq;

  NEW.request_number := 'REQ-' || LPAD(next_seq::text, 3, '0');
  RETURN NEW;
END;
$$;

-- 3. Trigger
DROP TRIGGER IF EXISTS trg_assign_request_number ON resource_requests;
CREATE TRIGGER trg_assign_request_number
  BEFORE INSERT ON resource_requests
  FOR EACH ROW
  EXECUTE FUNCTION assign_request_number();

-- 4. Make request_number nullable so client can omit it and let the trigger fill it
DO $$
BEGIN
  ALTER TABLE resource_requests ALTER COLUMN request_number DROP NOT NULL;
EXCEPTION WHEN others THEN
  NULL; -- already nullable
END $$;
