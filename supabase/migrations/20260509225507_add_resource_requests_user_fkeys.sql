/*
  # Add foreign key constraints from resource_requests to app_users

  ## Changes
  - Adds FK from resource_requests.requested_by_user_id -> app_users.id
  - Adds FK from resource_requests.approved_by_user_id -> app_users.id
  - These enable PostgREST to resolve the join when fetching request details
*/

ALTER TABLE resource_requests
  ADD CONSTRAINT resource_requests_requested_by_user_id_fkey
    FOREIGN KEY (requested_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL,
  ADD CONSTRAINT resource_requests_approved_by_user_id_fkey
    FOREIGN KEY (approved_by_user_id) REFERENCES app_users(id) ON DELETE SET NULL;
