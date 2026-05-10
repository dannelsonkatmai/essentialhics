/*
  # Add missing foreign key on request_fulfillments.fulfilled_by_user_id

  The request_fulfillments table has a fulfilled_by_user_id column referencing
  app_users but the FK constraint was never created. The Supabase join hint
  !request_fulfillments_fulfilled_by_user_id_fkey in the get query was failing
  because the constraint didn't exist, causing RequestDetail to show "not found".

  Changes:
  - Add FK constraint from request_fulfillments.fulfilled_by_user_id -> app_users.id
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'request_fulfillments_fulfilled_by_user_id_fkey'
  ) THEN
    ALTER TABLE request_fulfillments
      ADD CONSTRAINT request_fulfillments_fulfilled_by_user_id_fkey
      FOREIGN KEY (fulfilled_by_user_id) REFERENCES app_users(id);
  END IF;
END $$;
