-- Migration v14 fix: Ensure deal_payments has per-fee paid tracking columns
-- These columns are referenced by record-payment and sync-invoice routes.
-- Run this if v14 was not fully applied.

ALTER TABLE deal_payments ADD COLUMN IF NOT EXISTS service_fee_paid BOOLEAN DEFAULT false;
ALTER TABLE deal_payments ADD COLUMN IF NOT EXISTS inz_fee_paid BOOLEAN DEFAULT false;
ALTER TABLE deal_payments ADD COLUMN IF NOT EXISTS other_fee_paid BOOLEAN DEFAULT false;
ALTER TABLE deal_payments ADD COLUMN IF NOT EXISTS paid_amount_total DECIMAL(12,2) DEFAULT 0;

-- Ensure invoices has paid_amount and paid_date
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_date DATE;

-- Ensure invoice_payments table exists (from v14)
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  notes TEXT,
  matched_stage_id UUID REFERENCES deal_payments(id) ON DELETE SET NULL,
  matched_fee_type TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_stage ON invoice_payments(matched_stage_id);

-- Ensure xero_payment_id exists on invoice_payments (from v15)
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS xero_payment_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_payments_xero_id ON invoice_payments(xero_payment_id) WHERE xero_payment_id IS NOT NULL;
