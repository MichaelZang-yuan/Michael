-- Zoho OAuth tokens for CRM integration
CREATE TABLE IF NOT EXISTS zoho_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refresh_token text NOT NULL,
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE zoho_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access (API routes use service role)
CREATE POLICY "Service role only for zoho_tokens"
  ON zoho_tokens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
