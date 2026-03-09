-- CRM Migration V6: Contract System
-- Run this after crm_migration_v2.sql

-- ─── 1. Rename government_fee → inz_application_fee in deals ─────────────────
ALTER TABLE deals RENAME COLUMN government_fee TO inz_application_fee;

-- ─── 2. Add new columns to deals ────────────────────────────────────────────
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS refund_percentage integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'NZD',
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en';

-- ─── 3. Add new columns to deal_payments ───────────────────────────────────
ALTER TABLE deal_payments
  ADD COLUMN IF NOT EXISTS stage_name text,
  ADD COLUMN IF NOT EXISTS stage_details text,
  ADD COLUMN IF NOT EXISTS gst_type text DEFAULT 'exclusive',
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS payment_notes text,
  ADD COLUMN IF NOT EXISTS is_paid boolean DEFAULT false;

-- ─── 4. Add new columns to deal_contracts ──────────────────────────────────
ALTER TABLE deal_contracts
  ADD COLUMN IF NOT EXISTS adviser_signature text,
  ADD COLUMN IF NOT EXISTS adviser_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS adviser_signed_by text,
  ADD COLUMN IF NOT EXISTS client_signature text,
  ADD COLUMN IF NOT EXISTS client_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_sign_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS contract_html text;

-- ─── 5. Create system_settings table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
