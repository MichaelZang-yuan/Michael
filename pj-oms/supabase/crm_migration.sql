-- ============================================================
-- CRM Module Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. agents table (must be created before contacts and deals)
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  agent_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  agent_type TEXT, -- "individual" / "company"
  commission_rate NUMERIC,
  notes TEXT,
  assigned_sales_id UUID REFERENCES profiles(id),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE agents DISABLE ROW LEVEL SECURITY;

-- 2. contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT,
  email TEXT,
  secondary_email TEXT,
  mobile TEXT,
  message_app TEXT,
  nationality TEXT,
  date_of_birth DATE,
  type TEXT DEFAULT 'lead',
  service_required TEXT,
  on_offshore TEXT,
  lead_source TEXT,
  source_name TEXT,
  preferred_language TEXT DEFAULT 'English',
  address TEXT,
  marital_status TEXT,
  employer TEXT,
  school TEXT,
  description TEXT,
  currency TEXT DEFAULT 'NZD',
  client_number TEXT,
  current_visa_type TEXT,
  visa_expiry_date DATE,
  travel_expiry_date DATE,
  passport_number TEXT,
  passport_expiry_date DATE,
  student_insurance_expiry_date DATE,
  onedrive_folder_id TEXT,
  onedrive_folder_link TEXT,
  agent_id UUID REFERENCES agents(id),
  assigned_sales_id UUID REFERENCES profiles(id),
  department TEXT,
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;

-- 3. contact_medical_pcc table
CREATE TABLE IF NOT EXISTS contact_medical_pcc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  item TEXT, -- "medical" / "pcc" / "chest_xray" / "other"
  country TEXT,
  issue_date DATE,
  expiry_date DATE
);

ALTER TABLE contact_medical_pcc DISABLE ROW LEVEL SECURITY;

-- 4. contact_family_links table
CREATE TABLE IF NOT EXISTS contact_family_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  related_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  relationship TEXT, -- spouse / child / parent / sibling / partner / other
  notes TEXT
);

ALTER TABLE contact_family_links DISABLE ROW LEVEL SECURITY;

-- 5. companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_name TEXT NOT NULL,
  trading_name TEXT,
  nzbn TEXT,
  region TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  key_person_name TEXT,
  key_person_last_name TEXT,
  key_person_gender TEXT,
  key_person_passport_no TEXT,
  key_person_dob DATE,
  key_person_visa_status TEXT,
  key_person_role TEXT,
  accreditation_status TEXT DEFAULT 'none',
  accreditation_expiry DATE,
  job_title TEXT,
  job_check_expiry DATE,
  assigned_sales_id UUID REFERENCES profiles(id),
  department TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE companies DISABLE ROW LEVEL SECURITY;

-- 6. deals table
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deal_number TEXT UNIQUE,
  contact_id UUID REFERENCES contacts(id),
  company_id UUID REFERENCES companies(id),
  agent_id UUID REFERENCES agents(id),
  deal_type TEXT, -- "individual_visa" / "accreditation" / "job_check" / "school_application"
  visa_type TEXT,
  description TEXT,
  status TEXT DEFAULT 'draft',
  service_fee NUMERIC,
  government_fee NUMERIC,
  other_fee NUMERIC,
  total_amount NUMERIC,
  payment_status TEXT DEFAULT 'unpaid',
  assigned_sales_id UUID REFERENCES profiles(id),
  assigned_lia_id UUID REFERENCES profiles(id),
  department TEXT,
  submitted_date DATE,
  approved_date DATE,
  declined_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE deals DISABLE ROW LEVEL SECURITY;

-- 7. deal_applicants table
CREATE TABLE IF NOT EXISTS deal_applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  relationship TEXT, -- "main" / "spouse" / "child" / "parent" / "other"
  notes TEXT
);

ALTER TABLE deal_applicants DISABLE ROW LEVEL SECURITY;
