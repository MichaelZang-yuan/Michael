-- Migration v13: Xero OAuth integration
-- Run this after all previous migrations.

-- 1. Create xero_tokens table (single-row for shared OAuth tokens)
CREATE TABLE IF NOT EXISTS xero_tokens (
  id INT PRIMARY KEY DEFAULT 1,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  tenant_id_immigration TEXT,  -- PJ Immigration Limited
  tenant_id_international TEXT, -- PJ International Limited
  tenant_name_immigration TEXT,
  tenant_name_international TEXT,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add xero_invoice_id to commissions table
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS xero_invoice_id TEXT;
