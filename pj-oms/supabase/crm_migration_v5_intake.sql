-- =============================================
-- Intake Form System V5 Migration
-- Run in Supabase SQL Editor
-- =============================================

-- 1. Adjust intake_form_templates table
ALTER TABLE intake_form_templates ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE intake_form_templates ADD COLUMN IF NOT EXISTS language_options jsonb DEFAULT '["en","zh","th"]';
ALTER TABLE intake_form_templates ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;
ALTER TABLE intake_form_templates ADD COLUMN IF NOT EXISTS description jsonb;

-- 2. Adjust intake_forms table
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS draft_data jsonb;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS last_saved_at timestamptz;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS client_email text;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS progress integer DEFAULT 0;

-- Ensure token column has unique index (column is unique_token in existing schema)
CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_forms_unique_token ON intake_forms(unique_token);

-- Disable RLS
ALTER TABLE intake_form_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE intake_forms DISABLE ROW LEVEL SECURITY;
