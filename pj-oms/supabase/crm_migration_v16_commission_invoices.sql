-- Commission Invoice tables for PJ International Ltd school commission billing
-- Run this migration after v15

-- Commission Invoice 表
CREATE TABLE IF NOT EXISTS commission_invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number text NOT NULL UNIQUE,
  school_id uuid REFERENCES schools(id),
  school_name text NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL DEFAULT (CURRENT_DATE + interval '30 days'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partial', 'paid', 'cancelled')),
  subtotal decimal(12,2) NOT NULL DEFAULT 0,
  gst_amount decimal(12,2) NOT NULL DEFAULT 0,
  total decimal(12,2) NOT NULL DEFAULT 0,
  paid_amount decimal(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NZD',
  xero_invoice_id text,
  xero_tenant_id text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Commission Invoice Line Items
CREATE TABLE IF NOT EXISTS commission_invoice_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  commission_invoice_id uuid REFERENCES commission_invoices(id) ON DELETE CASCADE,
  commission_id uuid REFERENCES commissions(id),
  student_id uuid REFERENCES students(id),
  student_name text NOT NULL,
  student_number text,
  course_name text,
  enrollment_date date,
  tuition_fee decimal(12,2),
  commission_rate decimal(5,2),
  amount decimal(12,2) NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Commission Invoice 编号计数器
CREATE TABLE IF NOT EXISTS commission_invoice_counters (
  id text PRIMARY KEY DEFAULT 'default',
  next_number int NOT NULL DEFAULT 1
);
INSERT INTO commission_invoice_counters (id, next_number) VALUES ('default', 1) ON CONFLICT DO NOTHING;

-- commissions 表新增字段
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS commission_invoice_id uuid REFERENCES commission_invoices(id);
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS commission_invoice_item_id uuid REFERENCES commission_invoice_items(id);

-- Commission Invoice Payments (for recording payments against commission invoices)
CREATE TABLE IF NOT EXISTS commission_invoice_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  commission_invoice_id uuid REFERENCES commission_invoices(id) ON DELETE CASCADE,
  amount decimal(12,2) NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  notes text,
  xero_payment_id text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
