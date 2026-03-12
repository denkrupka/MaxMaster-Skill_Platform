-- Migration: Create robocizna catalog table and link table for positions
-- Separates simple labor entries from positions (which bundle labor + materials + equipment)

-- =====================================================
-- ROBOCIZNA CATALOG (simple labor items)
-- =====================================================
CREATE TABLE IF NOT EXISTS kosztorys_robocizna (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name TEXT NOT NULL,
    unit VARCHAR(20) DEFAULT 'szt.',
    price_unit DECIMAL(12,2) DEFAULT 0,
    time_hours INTEGER DEFAULT 0,
    time_minutes INTEGER DEFAULT 0,
    cost_type VARCHAR(10) DEFAULT 'rg' CHECK (cost_type IN ('rg', 'ryczalt')),
    cost_ryczalt DECIMAL(12,2) DEFAULT 0,
    category VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_robocizna_company
    ON kosztorys_robocizna(company_id);

ALTER TABLE kosztorys_robocizna ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kosztorys_robocizna_company_policy ON kosztorys_robocizna;
CREATE POLICY kosztorys_robocizna_company_policy ON kosztorys_robocizna
    FOR ALL
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

GRANT ALL ON kosztorys_robocizna TO authenticated;

-- =====================================================
-- LINKED ROBOCIZNA for positions (kosztorys_own_labours)
-- =====================================================
CREATE TABLE IF NOT EXISTS kosztorys_own_labour_robocizna (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    labour_id UUID NOT NULL REFERENCES kosztorys_own_labours(id) ON DELETE CASCADE,
    robocizna_name TEXT NOT NULL,
    robocizna_price DECIMAL(12,2) DEFAULT 0,
    robocizna_quantity DECIMAL(12,4) DEFAULT 1,
    source_robocizna_id UUID REFERENCES kosztorys_robocizna(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_own_labour_robocizna_labour
    ON kosztorys_own_labour_robocizna(labour_id);

GRANT ALL ON kosztorys_own_labour_robocizna TO authenticated;

-- Update trigger for robocizna
CREATE OR REPLACE FUNCTION update_kosztorys_robocizna_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_kosztorys_robocizna_updated_at ON kosztorys_robocizna;
CREATE TRIGGER trigger_kosztorys_robocizna_updated_at
    BEFORE UPDATE ON kosztorys_robocizna
    FOR EACH ROW EXECUTE FUNCTION update_kosztorys_robocizna_updated_at();
