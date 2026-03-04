-- Add 'negotiation' status to offers
ALTER TABLE offers
  DROP CONSTRAINT IF EXISTS offers_status_check;
ALTER TABLE offers
  ADD CONSTRAINT offers_status_check
  CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'negotiation'));

-- Negotiation sessions
CREATE TABLE IF NOT EXISTS offer_negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  round integer NOT NULL DEFAULT 1,
  initiated_by text NOT NULL CHECK (initiated_by IN ('owner', 'recipient')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'responded', 'accepted', 'rejected')),
  message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_negotiations_offer_id ON offer_negotiations(offer_id);

-- Negotiation items (counter-proposals for offer items)
CREATE TABLE IF NOT EXISTS offer_negotiation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id uuid NOT NULL REFERENCES offer_negotiations(id) ON DELETE CASCADE,
  offer_item_id uuid NOT NULL,
  proposed_quantity numeric,
  proposed_unit_price numeric,
  original_quantity numeric,
  original_unit_price numeric,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'counter')),
  counter_quantity numeric,
  counter_unit_price numeric,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_negotiation_items_negotiation_id ON offer_negotiation_items(negotiation_id);

-- Negotiation costs (counter-proposals for related costs)
CREATE TABLE IF NOT EXISTS offer_negotiation_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id uuid NOT NULL REFERENCES offer_negotiations(id) ON DELETE CASCADE,
  cost_id text NOT NULL,
  proposed_value numeric,
  original_value numeric,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'counter')),
  counter_value numeric,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_negotiation_costs_negotiation_id ON offer_negotiation_costs(negotiation_id);

-- Negotiation warunki (counter-proposals for warunki)
CREATE TABLE IF NOT EXISTS offer_negotiation_warunki (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id uuid NOT NULL REFERENCES offer_negotiations(id) ON DELETE CASCADE,
  warunek_key text NOT NULL,
  proposed_value text,
  original_value text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'counter')),
  counter_value text,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_negotiation_warunki_negotiation_id ON offer_negotiation_warunki(negotiation_id);

-- RLS policies
ALTER TABLE offer_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_negotiation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_negotiation_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_negotiation_warunki ENABLE ROW LEVEL SECURITY;

-- Authenticated users (company owners) can read/write their offer negotiations
CREATE POLICY "auth_offer_negotiations_select" ON offer_negotiations FOR SELECT TO authenticated
  USING (offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));
CREATE POLICY "auth_offer_negotiations_insert" ON offer_negotiations FOR INSERT TO authenticated
  WITH CHECK (offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));
CREATE POLICY "auth_offer_negotiations_update" ON offer_negotiations FOR UPDATE TO authenticated
  USING (offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY "auth_offer_negotiation_items_select" ON offer_negotiation_items FOR SELECT TO authenticated
  USING (negotiation_id IN (SELECT id FROM offer_negotiations WHERE offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))));
CREATE POLICY "auth_offer_negotiation_items_insert" ON offer_negotiation_items FOR INSERT TO authenticated
  WITH CHECK (negotiation_id IN (SELECT id FROM offer_negotiations WHERE offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))));
CREATE POLICY "auth_offer_negotiation_items_update" ON offer_negotiation_items FOR UPDATE TO authenticated
  USING (negotiation_id IN (SELECT id FROM offer_negotiations WHERE offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))));

CREATE POLICY "auth_offer_negotiation_costs_select" ON offer_negotiation_costs FOR SELECT TO authenticated
  USING (negotiation_id IN (SELECT id FROM offer_negotiations WHERE offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))));
CREATE POLICY "auth_offer_negotiation_costs_insert" ON offer_negotiation_costs FOR INSERT TO authenticated
  WITH CHECK (negotiation_id IN (SELECT id FROM offer_negotiations WHERE offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))));
CREATE POLICY "auth_offer_negotiation_costs_update" ON offer_negotiation_costs FOR UPDATE TO authenticated
  USING (negotiation_id IN (SELECT id FROM offer_negotiations WHERE offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))));

CREATE POLICY "auth_offer_negotiation_warunki_select" ON offer_negotiation_warunki FOR SELECT TO authenticated
  USING (negotiation_id IN (SELECT id FROM offer_negotiations WHERE offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))));
CREATE POLICY "auth_offer_negotiation_warunki_insert" ON offer_negotiation_warunki FOR INSERT TO authenticated
  WITH CHECK (negotiation_id IN (SELECT id FROM offer_negotiations WHERE offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))));
CREATE POLICY "auth_offer_negotiation_warunki_update" ON offer_negotiation_warunki FOR UPDATE TO authenticated
  USING (negotiation_id IN (SELECT id FROM offer_negotiations WHERE offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))));

-- Anon (public link recipients) can read and insert/update negotiations for offers with public tokens
CREATE POLICY "anon_offer_negotiations_select" ON offer_negotiations FOR SELECT TO anon
  USING (offer_id IN (SELECT id FROM offers WHERE public_token IS NOT NULL AND deleted_at IS NULL));
CREATE POLICY "anon_offer_negotiations_insert" ON offer_negotiations FOR INSERT TO anon
  WITH CHECK (offer_id IN (SELECT id FROM offers WHERE public_token IS NOT NULL AND deleted_at IS NULL));
CREATE POLICY "anon_offer_negotiations_update" ON offer_negotiations FOR UPDATE TO anon
  USING (offer_id IN (SELECT id FROM offers WHERE public_token IS NOT NULL AND deleted_at IS NULL));

CREATE POLICY "anon_offer_negotiation_items_select" ON offer_negotiation_items FOR SELECT TO anon
  USING (negotiation_id IN (SELECT id FROM offer_negotiations WHERE offer_id IN (SELECT id FROM offers WHERE public_token IS NOT NULL AND deleted_at IS NULL)));
CREATE POLICY "anon_offer_negotiation_items_insert" ON offer_negotiation_items FOR INSERT TO anon
  WITH CHECK (negotiation_id IN (SELECT id FROM offer_negotiations WHERE offer_id IN (SELECT id FROM offers WHERE public_token IS NOT NULL AND deleted_at IS NULL)));
CREATE POLICY "anon_offer_negotiation_items_update" ON offer_negotiation_items FOR UPDATE TO anon
  USING (negotiation_id IN (SELECT id FROM offer_negotiations WHERE offer_id IN (SELECT id FROM offers WHERE public_token IS NOT NULL AND deleted_at IS NULL)));

CREATE POLICY "anon_offer_negotiation_costs_select" ON offer_negotiation_costs FOR SELECT TO anon
  USING (negotiation_id IN (SELECT id FROM offer_negotiations WHERE offer_id IN (SELECT id FROM offers WHERE public_token IS NOT NULL AND deleted_at IS NULL)));
CREATE POLICY "anon_offer_negotiation_costs_insert" ON offer_negotiation_costs FOR INSERT TO anon
  WITH CHECK (negotiation_id IN (SELECT id FROM offer_negotiations WHERE offer_id IN (SELECT id FROM offers WHERE public_token IS NOT NULL AND deleted_at IS NULL)));

CREATE POLICY "anon_offer_negotiation_warunki_select" ON offer_negotiation_warunki FOR SELECT TO anon
  USING (negotiation_id IN (SELECT id FROM offer_negotiations WHERE offer_id IN (SELECT id FROM offers WHERE public_token IS NOT NULL AND deleted_at IS NULL)));
CREATE POLICY "anon_offer_negotiation_warunki_insert" ON offer_negotiation_warunki FOR INSERT TO anon
  WITH CHECK (negotiation_id IN (SELECT id FROM offer_negotiations WHERE offer_id IN (SELECT id FROM offers WHERE public_token IS NOT NULL AND deleted_at IS NULL)));
