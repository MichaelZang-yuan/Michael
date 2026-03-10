-- Cover Letters table for AI-generated immigration cover letters
CREATE TABLE cover_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'draft',  -- draft | final
  pdf_url TEXT,
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE cover_letters DISABLE ROW LEVEL SECURITY;

CREATE INDEX idx_cover_letters_deal ON cover_letters(deal_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_cover_letters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cover_letters_updated_at
  BEFORE UPDATE ON cover_letters
  FOR EACH ROW
  EXECUTE FUNCTION update_cover_letters_updated_at();
