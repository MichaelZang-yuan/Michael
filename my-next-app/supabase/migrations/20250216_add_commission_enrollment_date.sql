-- Add enrollment_date column to commissions table
ALTER TABLE commissions
ADD COLUMN IF NOT EXISTS enrollment_date date;
