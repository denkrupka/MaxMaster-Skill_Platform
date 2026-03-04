-- SMS verification codes for offer acceptance
CREATE TABLE IF NOT EXISTS offer_sms_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_sms_verifications_offer_id ON offer_sms_verifications(offer_id);

-- RLS
ALTER TABLE offer_sms_verifications ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their company's offer verifications
CREATE POLICY "auth_sms_verify_select" ON offer_sms_verifications FOR SELECT TO authenticated
  USING (offer_id IN (SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

-- Anon can read and insert for public offers (needed for verification flow)
CREATE POLICY "anon_sms_verify_select" ON offer_sms_verifications FOR SELECT TO anon
  USING (offer_id IN (SELECT id FROM offers WHERE public_token IS NOT NULL AND deleted_at IS NULL));
CREATE POLICY "anon_sms_verify_insert" ON offer_sms_verifications FOR INSERT TO anon
  WITH CHECK (offer_id IN (SELECT id FROM offers WHERE public_token IS NOT NULL AND deleted_at IS NULL));
CREATE POLICY "anon_sms_verify_update" ON offer_sms_verifications FOR UPDATE TO anon
  USING (offer_id IN (SELECT id FROM offers WHERE public_token IS NOT NULL AND deleted_at IS NULL));
