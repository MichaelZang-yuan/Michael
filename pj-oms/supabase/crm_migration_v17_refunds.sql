-- Refund management + Foreign currency payments
-- Run after v16

-- Refund Requests
CREATE TABLE IF NOT EXISTS refund_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  deal_number text NOT NULL,
  client_name text NOT NULL,

  -- 金额计算
  total_paid decimal(12,2) NOT NULL,
  refund_percentage decimal(5,2) NOT NULL,
  calculated_refund decimal(12,2) NOT NULL,
  approved_refund decimal(12,2),
  actual_refund decimal(12,2),

  -- 扣除项
  deduction_details jsonb DEFAULT '[]',
  total_deductions decimal(12,2) DEFAULT 0,

  -- 状态工作流
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed', 'cancelled')),

  -- 退款方式
  refund_method text,
  refund_currency text DEFAULT 'NZD',
  bank_account_details text,

  -- 人员和时间
  requested_by uuid REFERENCES auth.users(id),
  requested_at timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  completed_by uuid REFERENCES auth.users(id),
  completed_at timestamptz,

  -- Xero
  xero_credit_note_id text,

  reason text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Foreign Currency Payments
CREATE TABLE IF NOT EXISTS foreign_currency_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid REFERENCES invoices(id),
  deal_id uuid REFERENCES deals(id),

  amount decimal(12,2) NOT NULL,
  currency text NOT NULL CHECK (currency IN ('CNY', 'THB')),
  exchange_rate decimal(10,4),
  nzd_equivalent decimal(12,2),

  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  payment_reference text,

  status text DEFAULT 'received' CHECK (status IN ('received', 'confirmed', 'disputed')),

  recorded_by uuid REFERENCES auth.users(id),
  confirmed_by uuid REFERENCES auth.users(id),
  confirmed_at timestamptz,

  notes text,
  created_at timestamptz DEFAULT now()
);
