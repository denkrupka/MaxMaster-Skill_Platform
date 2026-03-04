-- Comments table for offers (threaded, per-item)
CREATE TABLE IF NOT EXISTS offer_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  offer_item_id uuid,  -- NULL = general comment, non-NULL = comment on specific item
  parent_id uuid REFERENCES offer_comments(id) ON DELETE CASCADE,  -- threading
  author_type text NOT NULL CHECK (author_type IN ('owner', 'recipient')),
  author_name text NOT NULL DEFAULT '',
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  is_answered boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_comments_offer_id ON offer_comments(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_comments_item_id ON offer_comments(offer_item_id);
CREATE INDEX IF NOT EXISTS idx_offer_comments_parent_id ON offer_comments(parent_id);

-- RLS
ALTER TABLE offer_comments ENABLE ROW LEVEL SECURITY;

-- Authenticated (company users)
CREATE POLICY "auth_offer_comments_select" ON offer_comments FOR SELECT TO authenticated
  USING (offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));
CREATE POLICY "auth_offer_comments_insert" ON offer_comments FOR INSERT TO authenticated
  WITH CHECK (offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));
CREATE POLICY "auth_offer_comments_update" ON offer_comments FOR UPDATE TO authenticated
  USING (offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));
CREATE POLICY "auth_offer_comments_delete" ON offer_comments FOR DELETE TO authenticated
  USING (offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

-- Anon (public offer recipients)
CREATE POLICY "anon_offer_comments_select" ON offer_comments FOR SELECT TO anon
  USING (offer_id IN (SELECT id FROM offers WHERE public_token IS NOT NULL AND deleted_at IS NULL));
CREATE POLICY "anon_offer_comments_insert" ON offer_comments FOR INSERT TO anon
  WITH CHECK (offer_id IN (SELECT id FROM offers WHERE public_token IS NOT NULL AND deleted_at IS NULL));
CREATE POLICY "anon_offer_comments_update" ON offer_comments FOR UPDATE TO anon
  USING (offer_id IN (SELECT id FROM offers WHERE public_token IS NOT NULL AND deleted_at IS NULL));
