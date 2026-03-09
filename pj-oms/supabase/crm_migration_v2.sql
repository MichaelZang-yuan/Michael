-- ============================================================
-- CRM Module Migration V2 — New workflow tables
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. deal_payments — payment schedule tracking
CREATE TABLE IF NOT EXISTS deal_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  payment_type TEXT, -- "service_fee" / "government_fee" / "other"
  description TEXT,
  amount NUMERIC NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'pending', -- "pending" / "paid" / "overdue"
  paid_date DATE,
  payment_method TEXT, -- "bank_transfer" / "credit_card" / "cash" / "other"
  receipt_sent BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE deal_payments DISABLE ROW LEVEL SECURITY;

-- 2. deal_contracts — contract management
CREATE TABLE IF NOT EXISTS deal_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  contract_number TEXT,
  contract_type TEXT, -- "individual" / "company"
  status TEXT DEFAULT 'draft', -- "draft" / "sent" / "client_signed" / "lia_signed" / "completed" / "cancelled"
  sent_date DATE,
  client_signed_date DATE,
  lia_signed_date DATE,
  completed_date DATE,
  contract_file_url TEXT,
  signed_file_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE deal_contracts DISABLE ROW LEVEL SECURITY;

-- 3. intake_forms — client information collection forms
CREATE TABLE IF NOT EXISTS intake_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  company_id UUID REFERENCES companies(id),
  form_type TEXT, -- "individual_visa" / "company_accreditation" / "job_check" / "school_application"
  unique_token TEXT UNIQUE,
  status TEXT DEFAULT 'draft', -- "draft" / "sent" / "in_progress" / "completed"
  sent_date DATE,
  completed_date DATE,
  form_data JSONB DEFAULT '{}',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE intake_forms DISABLE ROW LEVEL SECURITY;

-- 4. email_logs — email send history
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deal_id UUID REFERENCES deals(id),
  contact_id UUID REFERENCES contacts(id),
  company_id UUID REFERENCES companies(id),
  email_type TEXT,
  recipient_email TEXT,
  recipient_name TEXT,
  subject TEXT,
  body TEXT,
  status TEXT, -- "sent" / "failed"
  sent_by UUID REFERENCES auth.users(id)
);

ALTER TABLE email_logs DISABLE ROW LEVEL SECURITY;

-- 5. document_checklists — per-deal document tracking
CREATE TABLE IF NOT EXISTS document_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  item_name TEXT,
  required BOOLEAN DEFAULT TRUE,
  uploaded BOOLEAN DEFAULT FALSE,
  file_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE document_checklists DISABLE ROW LEVEL SECURITY;
