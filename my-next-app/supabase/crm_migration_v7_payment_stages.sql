-- Migration V7: Payment Stages Redesign
-- Each payment stage now tracks service_fee, inz_fee, other_fee separately
-- Also adds paid_at timestamp and paid_marked_by for audit trail

ALTER TABLE deal_payments
  ADD COLUMN IF NOT EXISTS service_fee_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inz_fee_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_fee_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_marked_by uuid REFERENCES auth.users(id);

-- Existing rows: populate new columns from amount (backward compat)
-- amount was single total, assume it was service fee
UPDATE deal_payments
SET service_fee_amount = amount
WHERE service_fee_amount = 0 AND amount IS NOT NULL AND amount > 0;
