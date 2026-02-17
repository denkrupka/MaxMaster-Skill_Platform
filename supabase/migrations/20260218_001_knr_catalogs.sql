-- KNR Catalogs and Prices Database Schema
-- This migration creates tables for storing KNR catalogs, positions, resources, and prices

-- =====================================================
-- KNR Catalog Folders (hierarchy structure)
-- =====================================================
CREATE TABLE IF NOT EXISTS knr_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    xid TEXT UNIQUE NOT NULL,                    -- Original external ID
    basis TEXT NOT NULL,                         -- Code like "KNNR 1", "KNNR 1 01"
    name TEXT NOT NULL,                          -- Folder name
    path TEXT NOT NULL,                          -- Full path like "KNNR 1 / KNNR 1 01"
    depth INTEGER NOT NULL DEFAULT 0,            -- Hierarchy depth (0=catalog, 1=chapter, 2=table)
    parent_xid TEXT,                             -- Parent folder xid
    is_system BOOLEAN NOT NULL DEFAULT true,     -- System catalog (true) or user uploaded (false)
    company_id UUID REFERENCES companies(id),    -- NULL for system catalogs
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knr_folders_basis ON knr_folders(basis);
CREATE INDEX idx_knr_folders_path ON knr_folders(path);
CREATE INDEX idx_knr_folders_depth ON knr_folders(depth);
CREATE INDEX idx_knr_folders_company ON knr_folders(company_id);
CREATE INDEX idx_knr_folders_parent ON knr_folders(parent_xid);

-- =====================================================
-- KNR Positions (cost items with norms)
-- =====================================================
CREATE TABLE IF NOT EXISTS knr_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    xid TEXT UNIQUE NOT NULL,                    -- Original external ID
    folder_xid TEXT NOT NULL,                    -- Parent folder xid
    root_xid TEXT,                               -- Root catalog xid
    basis TEXT NOT NULL,                         -- Code like "KNNR 1 0101-01"
    name TEXT NOT NULL,                          -- Position name
    unit TEXT NOT NULL,                          -- Unit like "m3", "szt."
    ordinal_number INTEGER NOT NULL DEFAULT 1,   -- Order within folder
    path TEXT NOT NULL,                          -- Full path
    is_system BOOLEAN NOT NULL DEFAULT true,
    company_id UUID REFERENCES companies(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_knr_position_folder FOREIGN KEY (folder_xid)
        REFERENCES knr_folders(xid) ON DELETE CASCADE
);

CREATE INDEX idx_knr_positions_basis ON knr_positions(basis);
CREATE INDEX idx_knr_positions_folder ON knr_positions(folder_xid);
CREATE INDEX idx_knr_positions_company ON knr_positions(company_id);

-- =====================================================
-- KNR Position Resources (RMS - labor, material, equipment norms)
-- =====================================================
CREATE TABLE IF NOT EXISTS knr_position_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_xid TEXT NOT NULL,                  -- Parent position xid
    rms_xid TEXT NOT NULL,                       -- Resource xid
    type CHAR(1) NOT NULL CHECK (type IN ('R', 'M', 'S')), -- R=Robocizna, M=Material, S=Sprzęt
    ordinal_number INTEGER NOT NULL DEFAULT 1,
    norm DECIMAL(12, 6) NOT NULL DEFAULT 0,      -- Norm value
    rms_name TEXT NOT NULL,                      -- Resource name
    rms_unit TEXT NOT NULL,                      -- Resource unit
    rms_index TEXT,                              -- Catalog index
    rms_code INTEGER,                            -- RMS code
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_knr_resource_position FOREIGN KEY (position_xid)
        REFERENCES knr_positions(xid) ON DELETE CASCADE
);

CREATE INDEX idx_knr_resources_position ON knr_position_resources(position_xid);
CREATE INDEX idx_knr_resources_type ON knr_position_resources(type);
CREATE INDEX idx_knr_resources_rms_index ON knr_position_resources(rms_index);

-- =====================================================
-- Price Sources (Cenniki - price lists)
-- =====================================================
CREATE TABLE IF NOT EXISTS price_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                          -- "Cennik eKosztorysowanie", "Sekocenbud"
    source_type TEXT NOT NULL DEFAULT 'sekocenbud', -- sekocenbud, orgbud, custom
    is_system BOOLEAN NOT NULL DEFAULT true,
    company_id UUID REFERENCES companies(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_sources_company ON price_sources(company_id);
CREATE INDEX idx_price_sources_active ON price_sources(is_active);

-- =====================================================
-- Resource Prices (prices for labor, materials, equipment)
-- =====================================================
CREATE TABLE IF NOT EXISTS resource_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_source_id UUID NOT NULL REFERENCES price_sources(id) ON DELETE CASCADE,
    rms_index TEXT NOT NULL,                     -- Catalog index to match with knr_position_resources
    rms_type TEXT,                               -- ETO, etc.
    name TEXT NOT NULL,                          -- Resource name
    unit TEXT NOT NULL,                          -- Unit
    min_price DECIMAL(12, 2),                    -- Minimum price
    avg_price DECIMAL(12, 2),                    -- Average price
    max_price DECIMAL(12, 2),                    -- Maximum price
    region TEXT DEFAULT 'Poland',
    timestamp TIMESTAMPTZ,                       -- Price date
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(price_source_id, rms_index)
);

CREATE INDEX idx_resource_prices_source ON resource_prices(price_source_id);
CREATE INDEX idx_resource_prices_index ON resource_prices(rms_index);
CREATE INDEX idx_resource_prices_name ON resource_prices(name);

-- =====================================================
-- Insert default system price source
-- =====================================================
INSERT INTO price_sources (id, name, source_type, is_system, description)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Cennik eKosztorysowanie', 'ekosztorysowanie', true, 'Systemowy cennik eKosztorysowanie'),
    ('00000000-0000-0000-0000-000000000002', 'Sekocenbud', 'sekocenbud', true, 'Cennik Sekocenbud'),
    ('00000000-0000-0000-0000-000000000003', 'Orgbud', 'orgbud', true, 'Cennik Orgbud')
ON CONFLICT DO NOTHING;

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE knr_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE knr_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knr_position_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_prices ENABLE ROW LEVEL SECURITY;

-- System catalogs are visible to all authenticated users
CREATE POLICY "System KNR folders visible to all" ON knr_folders
    FOR SELECT USING (is_system = true);

CREATE POLICY "Company KNR folders visible to company members" ON knr_folders
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "System KNR positions visible to all" ON knr_positions
    FOR SELECT USING (is_system = true);

CREATE POLICY "Company KNR positions visible to company members" ON knr_positions
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "KNR resources visible to all" ON knr_position_resources
    FOR SELECT USING (true);

CREATE POLICY "System price sources visible to all" ON price_sources
    FOR SELECT USING (is_system = true);

CREATE POLICY "Company price sources visible to company members" ON price_sources
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Resource prices visible to all" ON resource_prices
    FOR SELECT USING (true);

-- Allow insert/update for company data
CREATE POLICY "Company members can manage their KNR folders" ON knr_folders
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Company members can manage their KNR positions" ON knr_positions
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Company members can manage their price sources" ON price_sources
    FOR ALL USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Company members can manage resource prices" ON resource_prices
    FOR ALL USING (
        price_source_id IN (
            SELECT id FROM price_sources WHERE company_id IN (
                SELECT company_id FROM profiles WHERE id = auth.uid()
            )
        )
    );
