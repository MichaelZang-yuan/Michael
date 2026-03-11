-- Migration v15: Xero payment sync support
-- Run this after all previous migrations.

-- 1. Add xero_payment_id to invoice_payments for deduplication
ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS xero_payment_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_payments_xero_id ON invoice_payments(xero_payment_id) WHERE xero_payment_id IS NOT NULL;
