-- Migration v10: Default signatures & Visa expiry notifications
-- Run this after all previous migrations.

-- 1. Add default_signature_url to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_signature_url text;

-- 2. Ensure contacts has visa_expiry_date (should already exist, safe to run)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS visa_expiry_date date;

-- 3. Create visa_expiry_notifications table
CREATE TABLE IF NOT EXISTS visa_expiry_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('90_days', '60_days', '30_days', '14_days', 'expired')),
  notified_at timestamptz NOT NULL DEFAULT now(),
  notified_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_visa_notifications_contact ON visa_expiry_notifications(contact_id);
CREATE INDEX IF NOT EXISTS idx_visa_notifications_notified_to ON visa_expiry_notifications(notified_to);
CREATE INDEX IF NOT EXISTS idx_visa_notifications_type ON visa_expiry_notifications(notification_type);

-- RLS
ALTER TABLE visa_expiry_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on visa_expiry_notifications"
  ON visa_expiry_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read visa_expiry_notifications"
  ON visa_expiry_notifications
  FOR SELECT
  TO authenticated
  USING (true);
