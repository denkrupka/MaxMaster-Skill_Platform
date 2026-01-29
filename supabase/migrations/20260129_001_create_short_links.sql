-- Short links table for URL shortening (SMS messages)
CREATE TABLE IF NOT EXISTS short_links (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code text UNIQUE NOT NULL,
    target_url text NOT NULL,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    click_count integer DEFAULT 0
);

-- Index for fast code lookups
CREATE INDEX IF NOT EXISTS idx_short_links_code ON short_links (code);

-- RLS
ALTER TABLE short_links ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed for redirect page)
CREATE POLICY "short_links_select" ON short_links FOR SELECT USING (true);

-- Authenticated users can insert
CREATE POLICY "short_links_insert" ON short_links FOR INSERT TO authenticated
    WITH CHECK (true);

-- Only creator can update
CREATE POLICY "short_links_update" ON short_links FOR UPDATE TO authenticated
    USING (created_by = auth.uid());
