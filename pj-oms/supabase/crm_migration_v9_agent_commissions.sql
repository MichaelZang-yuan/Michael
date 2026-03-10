-- Migration v9: Agent Commissions
-- Adds commission management for external agents

-- 1a. Add default commission type to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS default_commission_type TEXT DEFAULT 'percentage';
  -- 'percentage' or 'fixed'

-- 1b. Create agent_commissions table
CREATE TABLE IF NOT EXISTS agent_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  commission_type TEXT NOT NULL DEFAULT 'percentage',
  commission_rate NUMERIC NOT NULL DEFAULT 0,
  base_amount NUMERIC DEFAULT 0,
  commission_amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / approved / paid
  paid_date DATE,
  paid_by UUID REFERENCES auth.users(id),
  invoice_number TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE agent_commissions DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_agent_commissions_agent ON agent_commissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_commissions_deal ON agent_commissions(deal_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_commissions_deal_unique ON agent_commissions(deal_id);
