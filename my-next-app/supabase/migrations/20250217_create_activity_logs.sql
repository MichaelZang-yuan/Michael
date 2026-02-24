-- Activity logs table for tracking user actions
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read activity logs
CREATE POLICY "Authenticated users can read activity_logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert (for logging)
CREATE POLICY "Authenticated users can insert activity_logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);
