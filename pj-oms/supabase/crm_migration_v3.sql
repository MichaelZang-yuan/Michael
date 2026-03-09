-- ============================================================
-- CRM Module Migration V3 — Contract & Intake Form Templates
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. contract_templates
CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  language TEXT, -- "english" / "chinese" / "thai"
  target_type TEXT, -- "individual" / "company"
  content TEXT, -- HTML with {{placeholders}}
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE contract_templates DISABLE ROW LEVEL SECURITY;

-- 2. intake_form_templates
CREATE TABLE IF NOT EXISTS intake_form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  form_type TEXT, -- "individual_visa" / "company_accreditation" / "job_check" / "school_application"
  language TEXT, -- "english" / "chinese" / "thai"
  fields JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE intake_form_templates DISABLE ROW LEVEL SECURITY;

-- 3. Add new columns to deal_contracts
ALTER TABLE deal_contracts
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES contract_templates(id),
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id);

-- 4. Add template_id to intake_forms
ALTER TABLE intake_forms
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES intake_form_templates(id);
