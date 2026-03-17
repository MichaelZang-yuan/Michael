-- ============================================================================
-- Migration v18: Deal Approval Workflow, Notifications, Visa Submission/Result
-- ============================================================================

-- 1) Deal Approvals table
CREATE TABLE IF NOT EXISTS deal_approvals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,

  -- Approval participants
  requested_by uuid REFERENCES auth.users(id),
  assigned_to uuid REFERENCES auth.users(id),  -- LIA

  -- Status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),

  -- LIA feedback
  decline_reason text,
  lia_notes text,
  changes_made jsonb DEFAULT '[]',

  -- Timestamps
  requested_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,

  created_at timestamptz DEFAULT now()
);

-- 2) Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Content
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,  -- deal_approval_request, deal_approval_result, contract_signed, visa_submitted, intake_received, visa_result, stage_update

  -- Relations
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  link text,

  -- Status
  is_read boolean DEFAULT false,

  -- Email
  email_sent boolean DEFAULT false,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- 3) Add new columns to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS assigned_copywriter_id uuid REFERENCES auth.users(id);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'none' CHECK (approval_status IN ('none', 'pending_approval', 'approved', 'declined'));
ALTER TABLE deals ADD COLUMN IF NOT EXISTS visa_submitted_at timestamptz;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS visa_submitted_by uuid REFERENCES auth.users(id);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS visa_result_status text CHECK (visa_result_status IN ('approved', 'declined', 'aip', 'rfi_ppi'));
ALTER TABLE deals ADD COLUMN IF NOT EXISTS visa_result_notes text;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS visa_result_updated_at timestamptz;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS visa_result_updated_by uuid REFERENCES auth.users(id);

-- 4) Disable RLS on new tables (consistent with existing pattern)
ALTER TABLE deal_approvals DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
