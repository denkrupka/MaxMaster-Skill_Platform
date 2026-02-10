-- Migration: Create kosztorys_cost_estimates table for full estimate editor
-- Based on eKosztorysowanie.pl schema

-- =====================================================
-- MAIN TABLE: COST ESTIMATES
-- =====================================================

CREATE TABLE IF NOT EXISTS kosztorys_cost_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by_id UUID NOT NULL REFERENCES users(id),

    -- Settings (JSON with type, name, description, precision, print settings)
    settings JSONB NOT NULL DEFAULT '{
        "type": "contractor",
        "name": "Nowy kosztorys",
        "description": "",
        "defaultCurrency": "PLN",
        "calculationTemplate": "overhead-on-top",
        "precision": {
            "norms": 6,
            "resources": 2,
            "measurements": 2,
            "unitValues": 2,
            "positionBase": 2,
            "costEstimateBase": 2,
            "roundingMethod": "default"
        }
    }'::jsonb,

    -- Data (JSON with root, sections, positions)
    data JSONB NOT NULL DEFAULT '{
        "root": {
            "sectionIds": [],
            "positionIds": [],
            "factors": {"labor": 1, "material": 1, "equipment": 1, "waste": 0},
            "overheads": []
        },
        "sections": {},
        "positions": {}
    }'::jsonb,

    -- Calculated totals
    total_labor DECIMAL(15,2) DEFAULT 0,
    total_material DECIMAL(15,2) DEFAULT 0,
    total_equipment DECIMAL(15,2) DEFAULT 0,
    total_overhead DECIMAL(15,2) DEFAULT 0,
    total_value DECIMAL(15,2) DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_kosztorys_cost_estimates_company
    ON kosztorys_cost_estimates(company_id);

CREATE INDEX IF NOT EXISTS idx_kosztorys_cost_estimates_created_by
    ON kosztorys_cost_estimates(created_by_id);

CREATE INDEX IF NOT EXISTS idx_kosztorys_cost_estimates_settings_type
    ON kosztorys_cost_estimates USING GIN ((settings->'type'));

CREATE INDEX IF NOT EXISTS idx_kosztorys_cost_estimates_created_at
    ON kosztorys_cost_estimates(created_at DESC);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_kosztorys_cost_estimates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_kosztorys_cost_estimates_updated_at
    ON kosztorys_cost_estimates;

CREATE TRIGGER trigger_kosztorys_cost_estimates_updated_at
    BEFORE UPDATE ON kosztorys_cost_estimates
    FOR EACH ROW EXECUTE FUNCTION update_kosztorys_cost_estimates_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE kosztorys_cost_estimates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see estimates from their company
DROP POLICY IF EXISTS kosztorys_cost_estimates_company_policy ON kosztorys_cost_estimates;
CREATE POLICY kosztorys_cost_estimates_company_policy ON kosztorys_cost_estimates
    FOR ALL
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- =====================================================
-- COMMENTS TABLE FOR ESTIMATES
-- =====================================================

CREATE TABLE IF NOT EXISTS kosztorys_cost_estimate_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cost_estimate_id UUID NOT NULL REFERENCES kosztorys_cost_estimates(id) ON DELETE CASCADE,
    anchor_id UUID,  -- ID of section, position, or resource

    task_category VARCHAR(50) DEFAULT 'none',  -- none, needs_verification, price_check, measurement_check
    task_status VARCHAR(20) DEFAULT 'todo',    -- todo, in_progress, done
    content TEXT NOT NULL,

    assignee_id UUID REFERENCES users(id),
    author_id UUID NOT NULL REFERENCES users(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_threads_estimate
    ON kosztorys_cost_estimate_threads(cost_estimate_id);

CREATE INDEX IF NOT EXISTS idx_kosztorys_threads_anchor
    ON kosztorys_cost_estimate_threads(anchor_id);

ALTER TABLE kosztorys_cost_estimate_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kosztorys_threads_company_policy ON kosztorys_cost_estimate_threads;
CREATE POLICY kosztorys_threads_company_policy ON kosztorys_cost_estimate_threads
    FOR ALL
    USING (cost_estimate_id IN (
        SELECT id FROM kosztorys_cost_estimates
        WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    ));

-- =====================================================
-- CATALOGS TABLE (KNR, KNNR, KSNR norms)
-- =====================================================

CREATE TABLE IF NOT EXISTS kosztorys_catalogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL,  -- KNNR, KNR, KSNR
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default catalogs
INSERT INTO kosztorys_catalogs (code, name) VALUES
    ('KNNR', 'Katalog Nakładów Nakładowych Roboczych'),
    ('KNNR-W', 'KNNR - Wersja Rozszerzona'),
    ('KNR', 'Katalog Nakładów Rzeczowych'),
    ('KSNR', 'Katalog Scalonych Nakładów Rzeczowych')
ON CONFLICT DO NOTHING;

-- =====================================================
-- CATALOG ITEMS TABLE (Norms from catalogs)
-- =====================================================

CREATE TABLE IF NOT EXISTS kosztorys_catalog_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id UUID REFERENCES kosztorys_catalogs(id),
    code VARCHAR(50) NOT NULL,   -- "KNNR 5 0701-01"
    name TEXT NOT NULL,
    unit_label VARCHAR(20) NOT NULL,
    unit_index VARCHAR(10) NOT NULL,

    -- Default resources as JSON
    default_resources JSONB DEFAULT '[]'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(code)
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_catalog_items_code
    ON kosztorys_catalog_items(code);

CREATE INDEX IF NOT EXISTS idx_kosztorys_catalog_items_catalog
    ON kosztorys_catalog_items(catalog_id);

-- =====================================================
-- UNITS REFERENCE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS kosztorys_units (
    id SERIAL PRIMARY KEY,
    index VARCHAR(10) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    lang VARCHAR(5) DEFAULT 'pl'
);

-- Insert default units
INSERT INTO kosztorys_units (index, unit, name, lang) VALUES
    ('020', 'szt.', 'sztuka', 'pl'),
    ('023', 'tys.szt.', 'tysiąc sztuk', 'pl'),
    ('033', 'kg', 'kilogram', 'pl'),
    ('034', 't', 'tona', 'pl'),
    ('040', 'm', 'metr', 'pl'),
    ('050', 'm2', 'metr kwadratowy', 'pl'),
    ('060', 'm3', 'metr sześcienny', 'pl'),
    ('070', 'kW', 'kilowat', 'pl'),
    ('090', 'kpl', 'komplet', 'pl'),
    ('149', 'r-g', 'roboczogodzina', 'pl'),
    ('150', 'm-g', 'maszynogodzina', 'pl')
ON CONFLICT DO NOTHING;

-- =====================================================
-- OVERHEAD TEMPLATES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS kosztorys_overhead_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,  -- "Koszty pośrednie (Kp)", "Zysk (Z)"
    type VARCHAR(20) NOT NULL,   -- 'percentage', 'fixed'
    value DECIMAL(10,4) NOT NULL,

    applies_to_labor BOOLEAN DEFAULT FALSE,
    applies_to_material BOOLEAN DEFAULT FALSE,
    applies_to_equipment BOOLEAN DEFAULT FALSE,

    is_default BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_overhead_templates_company
    ON kosztorys_overhead_templates(company_id);

ALTER TABLE kosztorys_overhead_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kosztorys_overhead_templates_policy ON kosztorys_overhead_templates;
CREATE POLICY kosztorys_overhead_templates_policy ON kosztorys_overhead_templates
    FOR ALL
    USING (
        company_id IS NULL
        OR company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    );

-- Insert default overhead templates (global, not company-specific)
INSERT INTO kosztorys_overhead_templates (company_id, name, type, value, applies_to_labor, applies_to_material, applies_to_equipment, is_default, sort_order) VALUES
    (NULL, 'Koszty pośrednie (Kp)', 'percentage', 65.00, true, false, false, true, 1),
    (NULL, 'Zysk (Z)', 'percentage', 10.00, true, false, false, true, 2),
    (NULL, 'Koszty zakupu (Kz)', 'percentage', 5.00, false, true, false, true, 3)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SAMPLE CATALOG ITEMS (for testing)
-- =====================================================

-- Get KNNR catalog ID
DO $$
DECLARE
    knnr_id UUID;
BEGIN
    SELECT id INTO knnr_id FROM kosztorys_catalogs WHERE code = 'KNNR' LIMIT 1;

    IF knnr_id IS NOT NULL THEN
        INSERT INTO kosztorys_catalog_items (catalog_id, code, name, unit_label, unit_index, default_resources) VALUES
        (knnr_id, 'KNNR 5 0701-01', 'Kopanie rowów dla kabli wykonywane ręcznie w gruncie kat. I-II', 'm3', '060', '[
            {"type": "labor", "name": "robotnicy", "normValue": 1.35, "unitLabel": "r-g", "unitIndex": "149"}
        ]'::jsonb),
        (knnr_id, 'KNNR 5 0702-01', 'Zasypywanie rowów dla kabli wykonanych ręcznie w gruncie kat. I-II', 'm3', '060', '[
            {"type": "labor", "name": "robotnicy", "normValue": 1.0769, "unitLabel": "r-g", "unitIndex": "149"},
            {"type": "equipment", "name": "Koparka", "normValue": 16.9, "unitLabel": "m-g", "unitIndex": "150"}
        ]'::jsonb),
        (knnr_id, 'KNNR 5 0301-01', 'Układanie kabli w rowach kablowych - kabel do 1 kg/m', 'm', '040', '[
            {"type": "labor", "name": "robotnicy", "normValue": 0.12, "unitLabel": "r-g", "unitIndex": "149"},
            {"type": "material", "name": "kabel", "normValue": 1.02, "unitLabel": "m", "unitIndex": "040"}
        ]'::jsonb),
        (knnr_id, 'KNNR 5 0801-01', 'Montaż i stawianie słupów oświetleniowych', 'szt.', '020', '[
            {"type": "labor", "name": "robotnicy", "normValue": 2.5, "unitLabel": "r-g", "unitIndex": "149"},
            {"type": "equipment", "name": "dźwig samochodowy", "normValue": 0.3, "unitLabel": "m-g", "unitIndex": "150"}
        ]'::jsonb)
        ON CONFLICT (code) DO NOTHING;
    END IF;
END $$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT ALL ON kosztorys_cost_estimates TO authenticated;
GRANT ALL ON kosztorys_cost_estimate_threads TO authenticated;
GRANT SELECT ON kosztorys_catalogs TO authenticated;
GRANT SELECT ON kosztorys_catalog_items TO authenticated;
GRANT SELECT ON kosztorys_units TO authenticated;
GRANT ALL ON kosztorys_overhead_templates TO authenticated;
