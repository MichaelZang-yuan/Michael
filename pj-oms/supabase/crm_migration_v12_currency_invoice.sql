-- Migration v12: Currency field on deal_payments, invoices system, service price list
-- Run this after all previous migrations.

-- 1. Add currency column to deal_payments
ALTER TABLE deal_payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NZD';

-- 2. Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  currency TEXT NOT NULL DEFAULT 'NZD',
  status TEXT NOT NULL DEFAULT 'draft',
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_stage_ids TEXT[] DEFAULT '{}',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  gst_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  pdf_url TEXT,
  sent_at TIMESTAMPTZ,
  sent_to_email TEXT,
  xero_invoice_id TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_deal ON invoices(deal_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_currency ON invoices(currency);

-- 3. Create invoice_counters table for atomic invoice number generation
CREATE TABLE IF NOT EXISTS invoice_counters (
  currency TEXT PRIMARY KEY,
  last_number INT NOT NULL DEFAULT 0
);

INSERT INTO invoice_counters (currency, last_number) VALUES
  ('NZD', 0),
  ('CNY', 0),
  ('THB', 0)
ON CONFLICT (currency) DO NOTHING;

-- 4. Create service_price_list table
CREATE TABLE IF NOT EXISTS service_price_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  service_name TEXT NOT NULL,
  service_fee NUMERIC NOT NULL DEFAULT 0,
  inz_fee NUMERIC NOT NULL DEFAULT 0,
  inz_fee_note TEXT,
  currency TEXT NOT NULL DEFAULT 'NZD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_price_list_category ON service_price_list(category);
CREATE INDEX IF NOT EXISTS idx_service_price_list_active ON service_price_list(is_active);
