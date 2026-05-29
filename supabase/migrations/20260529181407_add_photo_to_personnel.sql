/*
  # Add Photo Support to Personnel Library

  ## Summary
  Adds a photo_url column to the facility_personnel table and creates a Supabase
  Storage bucket for personnel headshots. This enables the photo org chart feature
  which generates a visual HICS organizational chart with staff photos.

  ## Modified Tables

  ### facility_personnel
  - Added `photo_url` (text, optional) — public URL to the person's headshot photo
    stored in the `personnel-photos` Supabase Storage bucket. NULL means no photo;
    the org chart will show a silhouette placeholder instead.

  ## Storage
  - Creates a `personnel-photos` storage bucket (public reads, authenticated writes)
  - Storage policies allow facility members to upload/update photos for their facility's
    personnel, and anyone to read photos (for PDF rendering)

  ## Notes
  1. No data is lost — this is an additive change only.
  2. Existing personnel records will have photo_url = NULL, which is valid.
  3. The storage bucket uses a path convention: {facilityId}/{personnelId} so photos
     are naturally scoped to facilities.
*/

-- Add photo_url column to facility_personnel
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facility_personnel' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE facility_personnel ADD COLUMN photo_url text;
  END IF;
END $$;

-- Create the personnel-photos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'personnel-photos',
  'personnel-photos',
  true,
  5242880,  -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload photos for their facility's personnel
CREATE POLICY "Facility members can upload personnel photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'personnel-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT facility_id::text FROM user_facility_roles
      WHERE user_id = (
        SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
      )
      AND hics_role IN ('FACILITY_ADMIN', 'SYSTEM_ADMIN')
      AND is_deleted = false
    )
  );

-- Storage policy: authenticated users can update photos for their facility's personnel
CREATE POLICY "Facility admins can update personnel photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'personnel-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT facility_id::text FROM user_facility_roles
      WHERE user_id = (
        SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
      )
      AND hics_role IN ('FACILITY_ADMIN', 'SYSTEM_ADMIN')
      AND is_deleted = false
    )
  );

-- Storage policy: authenticated users can delete photos for their facility's personnel
CREATE POLICY "Facility admins can delete personnel photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'personnel-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT facility_id::text FROM user_facility_roles
      WHERE user_id = (
        SELECT id FROM app_users WHERE email = auth.jwt()->>'email'
      )
      AND hics_role IN ('FACILITY_ADMIN', 'SYSTEM_ADMIN')
      AND is_deleted = false
    )
  );

-- Storage policy: anyone can read photos (needed for PDF rendering)
CREATE POLICY "Public can read personnel photos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'personnel-photos');
