/*
  # Add suitable_substitutes column to resource_requests

  Adds a free-text memo field for "Suitable Substitutes and/or Suggested Sources"
  to the resource_requests table, matching the ICS-213RR form field.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'resource_requests' AND column_name = 'suitable_substitutes'
  ) THEN
    ALTER TABLE resource_requests ADD COLUMN suitable_substitutes text;
  END IF;
END $$;
