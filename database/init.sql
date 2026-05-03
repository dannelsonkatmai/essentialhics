-- PostgreSQL initialization script
-- Runs once when the Docker postgres container is first created.

-- ─── audit_logs: append-only ─────────────────────────────────────────────────

-- Enforce append-only on audit_logs: reject UPDATE and DELETE at the DB level
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs rows are immutable — UPDATE and DELETE are not permitted';
END;
$$;

-- Trigger is created AFTER Prisma migrations run (see backend/src/config/database.ts)
-- The migration runner calls: SELECT setup_audit_log_immutability();
CREATE OR REPLACE FUNCTION setup_audit_log_immutability()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'no_audit_log_mutation'
  ) THEN
    CREATE TRIGGER no_audit_log_mutation
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
  END IF;
END;
$$;

-- ─── resource_status_history: append-only ────────────────────────────────────

-- Phase 3: ICS resource status history must be immutable (audit trail requirement)
CREATE OR REPLACE FUNCTION prevent_resource_status_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'resource_status_history rows are immutable — UPDATE and DELETE are not permitted';
END;
$$;

-- Called by the migration runner alongside setup_audit_log_immutability()
CREATE OR REPLACE FUNCTION setup_resource_status_history_immutability()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'no_resource_status_history_mutation'
  ) THEN
    CREATE TRIGGER no_resource_status_history_mutation
    BEFORE UPDATE OR DELETE ON resource_status_history
    FOR EACH ROW EXECUTE FUNCTION prevent_resource_status_history_mutation();
  END IF;
END;
$$;
