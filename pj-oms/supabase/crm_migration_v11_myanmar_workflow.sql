-- Migration v11: Myanmar department workflow — school application tracking & new deal statuses
-- Run this after all previous migrations.

-- 1. Add school application fields to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS school_application_school_id uuid REFERENCES schools(id) ON DELETE SET NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS school_application_course text;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS school_application_status text;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS school_application_date date;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS school_application_offer_date date;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS school_application_tuition_fee numeric;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS school_application_enrollment_date date;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS school_application_notes text;

-- 2. No status constraint to update — deals.status is a plain text column with no CHECK constraint.
--    The new statuses (education_consultation, school_application, offer_received, education_only)
--    are handled purely in the application layer.

-- 3. Index for school application lookups
CREATE INDEX IF NOT EXISTS idx_deals_school_application_school ON deals(school_application_school_id) WHERE school_application_school_id IS NOT NULL;
