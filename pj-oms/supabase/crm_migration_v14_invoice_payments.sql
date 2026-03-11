-- Migration v14: Invoice payments tracking + partial payment support
-- Run this after all previous migrations.

-- 1. Add paid_amount and paid_date to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_date DATE;

-- 2. Create invoice_payments table for tracking individual payments
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,  -- bank_transfer / cash / card / other
  notes TEXT,
  matched_stage_id UUID REFERENCES deal_payments(id) ON DELETE SET NULL,
  matched_fee_type TEXT,  -- service_fee / inz_fee / other_fee / total / null(manual)
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_stage ON invoice_payments(matched_stage_id);

-- 3. Add per-fee paid tracking on deal_payments
ALTER TABLE deal_payments ADD COLUMN IF NOT EXISTS service_fee_paid BOOLEAN DEFAULT false;
ALTER TABLE deal_payments ADD COLUMN IF NOT EXISTS inz_fee_paid BOOLEAN DEFAULT false;
ALTER TABLE deal_payments ADD COLUMN IF NOT EXISTS other_fee_paid BOOLEAN DEFAULT false;
ALTER TABLE deal_payments ADD COLUMN IF NOT EXISTS paid_amount_total DECIMAL(12,2) DEFAULT 0;
