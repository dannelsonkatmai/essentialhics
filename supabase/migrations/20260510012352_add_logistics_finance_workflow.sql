/*
  # Add Logistics and Finance workflow to resource requests

  ## Overview
  Extends the resource request workflow so that after approval, requests route
  through a Logistics review and then a Finance review before being marked filled.

  ## New Status Values
  - LOGISTICS_REVIEW: Request is with the Logistics section for ordering
  - FINANCE_REVIEW: Request is with the Finance section for financial approval

  ## New Columns on resource_requests

  ### Logistics fields
  - logistics_order_number (text): The order/PO number assigned by Logistics
  - logistics_supplier (text): Supplier/vendor information
  - logistics_notes (text): Free-text notes from Logistics
  - logistics_approved_by_user_id (uuid FK → app_users): Who approved in Logistics
  - logistics_approved_at (timestamptz): When Logistics approved

  ### Finance fields
  - finance_order_placed_by (text): Name of person who placed the order
  - finance_comments (text): Comments from the Finance section
  - finance_approved_by_user_id (uuid FK → app_users): Who approved in Finance
  - finance_approved_at (timestamptz): When Finance approved

  ## Workflow
  DRAFT → SUBMITTED → APPROVED → LOGISTICS_REVIEW → FINANCE_REVIEW → FILLED
*/

-- Add new enum values (Postgres requires ALTER TYPE for each new value)
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'LOGISTICS_REVIEW' AFTER 'APPROVED';
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'FINANCE_REVIEW' AFTER 'LOGISTICS_REVIEW';

-- Logistics columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resource_requests' AND column_name = 'logistics_order_number') THEN
    ALTER TABLE resource_requests ADD COLUMN logistics_order_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resource_requests' AND column_name = 'logistics_supplier') THEN
    ALTER TABLE resource_requests ADD COLUMN logistics_supplier text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resource_requests' AND column_name = 'logistics_notes') THEN
    ALTER TABLE resource_requests ADD COLUMN logistics_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resource_requests' AND column_name = 'logistics_approved_by_user_id') THEN
    ALTER TABLE resource_requests ADD COLUMN logistics_approved_by_user_id uuid REFERENCES app_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resource_requests' AND column_name = 'logistics_approved_at') THEN
    ALTER TABLE resource_requests ADD COLUMN logistics_approved_at timestamptz;
  END IF;
END $$;

-- Finance columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resource_requests' AND column_name = 'finance_order_placed_by') THEN
    ALTER TABLE resource_requests ADD COLUMN finance_order_placed_by text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resource_requests' AND column_name = 'finance_comments') THEN
    ALTER TABLE resource_requests ADD COLUMN finance_comments text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resource_requests' AND column_name = 'finance_approved_by_user_id') THEN
    ALTER TABLE resource_requests ADD COLUMN finance_approved_by_user_id uuid REFERENCES app_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resource_requests' AND column_name = 'finance_approved_at') THEN
    ALTER TABLE resource_requests ADD COLUMN finance_approved_at timestamptz;
  END IF;
END $$;
