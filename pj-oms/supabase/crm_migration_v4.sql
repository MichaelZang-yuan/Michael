-- Staff Commission Settings: one row per staff member with default commission rate
CREATE TABLE IF NOT EXISTS staff_commission_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  default_commission_rate NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id)
);
ALTER TABLE staff_commission_settings DISABLE ROW LEVEL SECURITY;

-- Deal Staff Commissions: tracks per-deal commission allocations to staff
CREATE TABLE IF NOT EXISTS deal_staff_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  role_in_deal TEXT,
  commission_rate NUMERIC NOT NULL DEFAULT 0,
  base_amount NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  quarter TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  settled_date DATE,
  settled_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE deal_staff_commissions DISABLE ROW LEVEL SECURITY;
