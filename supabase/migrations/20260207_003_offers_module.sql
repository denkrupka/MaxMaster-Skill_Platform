-- =====================================================
-- Migration: Offers Module (Ofertowanie)
-- Date: 2026-02-07
-- Description: Commercial offers with templates and tracking
-- =====================================================

-- 1. Currencies
CREATE TABLE IF NOT EXISTS currencies (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE
);

INSERT INTO currencies (code, symbol, name, is_default) VALUES
  ('PLN', 'zł', 'Polski złoty', TRUE),
  ('EUR', '€', 'Euro', FALSE),
  ('USD', '$', 'Dolar amerykański', FALSE),
  ('GBP', '£', 'Funt brytyjski', FALSE),
  ('UAH', '₴', 'Hrywna ukraińska', FALSE),
  ('CZK', 'Kč', 'Korona czeska', FALSE)
ON CONFLICT DO NOTHING;

-- 2. Offer Templates
CREATE TABLE IF NOT EXISTS offer_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  content JSONB DEFAULT '{}'::jsonb,
  print_settings JSONB DEFAULT '{
    "pageSize": "A4",
    "orientation": "portrait",
    "margins": {"top": 20, "bottom": 20, "left": 20, "right": 20},
    "showLogo": true,
    "showFooter": true
  }'::jsonb,
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  preview_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Offers
DROP TYPE IF EXISTS offer_status CASCADE;
CREATE TYPE offer_status AS ENUM ('draft', 'sent', 'accepted', 'rejected');

CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
  template_id UUID REFERENCES offer_templates(id) ON DELETE SET NULL,
  number TEXT,
  name TEXT NOT NULL,
  status offer_status DEFAULT 'draft',
  language TEXT DEFAULT 'pl',
  currency_id INTEGER REFERENCES currencies(id) DEFAULT 1,
  valid_until DATE,
  -- Amounts
  total_amount NUMERIC(14,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(14,2) DEFAULT 0,
  final_amount NUMERIC(14,2) DEFAULT 0,
  -- Notes
  notes TEXT,
  internal_notes TEXT,
  -- Print settings override
  print_settings JSONB DEFAULT '{}'::jsonb,
  -- Public access
  public_token TEXT UNIQUE,
  public_url TEXT,
  viewed_at TIMESTAMPTZ,
  viewed_count INTEGER DEFAULT 0,
  -- Status dates
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  -- Meta
  created_by_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 4. Offer Sections
CREATE TABLE IF NOT EXISTS offer_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Offer Items
CREATE TABLE IF NOT EXISTS offer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  section_id UUID REFERENCES offer_sections(id) ON DELETE CASCADE,
  source_resource_id UUID REFERENCES estimate_resources(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit_measure_id INTEGER REFERENCES unit_measures(id),
  quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_price NUMERIC(14,4) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order INTEGER DEFAULT 0,
  is_optional BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Offer History
CREATE TABLE IF NOT EXISTS offer_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Enable RLS
ALTER TABLE offer_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_history ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies
CREATE POLICY "offer_templates_access" ON offer_templates
  FOR ALL USING (
    is_system = TRUE OR
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "offers_company_access" ON offers
  FOR ALL USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "offer_sections_access" ON offer_sections
  FOR ALL USING (offer_id IN (
    SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "offer_items_access" ON offer_items
  FOR ALL USING (offer_id IN (
    SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "offer_history_access" ON offer_history
  FOR ALL USING (offer_id IN (
    SELECT id FROM offers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_offer_templates_company ON offer_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_offers_company ON offers(company_id);
CREATE INDEX IF NOT EXISTS idx_offers_project ON offers(project_id);
CREATE INDEX IF NOT EXISTS idx_offers_client ON offers(client_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_public_token ON offers(public_token) WHERE public_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offer_sections_offer ON offer_sections(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_items_offer ON offer_items(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_items_section ON offer_items(section_id);
CREATE INDEX IF NOT EXISTS idx_offer_history_offer ON offer_history(offer_id);

-- 10. Triggers
CREATE TRIGGER update_offer_templates_updated_at BEFORE UPDATE ON offer_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offer_sections_updated_at BEFORE UPDATE ON offer_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offer_items_updated_at BEFORE UPDATE ON offer_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. Function to generate public token
CREATE OR REPLACE FUNCTION generate_offer_public_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_token IS NULL AND NEW.status != 'draft' THEN
    NEW.public_token := encode(gen_random_bytes(16), 'hex');
    NEW.public_url := '/offers/view/' || NEW.public_token;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER offer_generate_public_token
  BEFORE INSERT OR UPDATE OF status ON offers
  FOR EACH ROW EXECUTE FUNCTION generate_offer_public_token();

-- 12. Function to update offer totals
CREATE OR REPLACE FUNCTION update_offer_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE offers SET
    total_amount = COALESCE((
      SELECT SUM(total_price) FROM offer_items WHERE offer_id = COALESCE(NEW.offer_id, OLD.offer_id)
    ), 0),
    final_amount = COALESCE((
      SELECT SUM(total_price) FROM offer_items WHERE offer_id = COALESCE(NEW.offer_id, OLD.offer_id)
    ), 0) * (1 - COALESCE(discount_percent, 0) / 100) - COALESCE(discount_amount, 0)
  WHERE id = COALESCE(NEW.offer_id, OLD.offer_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_offer_totals_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON offer_items
  FOR EACH ROW EXECUTE FUNCTION update_offer_totals();
