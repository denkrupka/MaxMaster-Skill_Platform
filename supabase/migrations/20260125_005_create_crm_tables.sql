-- =============================================
-- CRM Tables for Sales Module
-- =============================================

-- Deal stages enum
CREATE TYPE deal_stage AS ENUM (
    'lead',           -- Nowy lead
    'qualified',      -- Zakwalifikowany
    'proposal',       -- Propozycja wysłana
    'negotiation',    -- Negocjacje
    'won',            -- Wygrana
    'lost'            -- Przegrana
);

-- Deal priority enum
CREATE TYPE deal_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);

-- Activity type enum
CREATE TYPE activity_type AS ENUM (
    'call',
    'email',
    'meeting',
    'note',
    'task'
);

-- =============================================
-- CRM Companies (Prospects/Clients)
-- =============================================
CREATE TABLE IF NOT EXISTS crm_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    tax_id VARCHAR(20),           -- NIP
    regon VARCHAR(14),
    industry VARCHAR(100),
    website VARCHAR(255),
    address_street VARCHAR(255),
    address_city VARCHAR(100),
    address_postal_code VARCHAR(10),
    address_country VARCHAR(100) DEFAULT 'Polska',
    employee_count INTEGER,       -- Estimated employee count
    annual_revenue DECIMAL(15, 2), -- Estimated annual revenue
    notes TEXT,
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, archived
    source VARCHAR(100),          -- How we found them
    assigned_sales_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CRM Contacts (LPR - Osoby decyzyjne)
-- =============================================
CREATE TABLE IF NOT EXISTS crm_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crm_company_id UUID REFERENCES crm_companies(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    position VARCHAR(100),        -- Job title
    department VARCHAR(100),
    is_decision_maker BOOLEAN DEFAULT FALSE, -- LPR flag
    linkedin_url VARCHAR(255),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CRM Deals (Sales Pipeline)
-- =============================================
CREATE TABLE IF NOT EXISTS crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    crm_company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    stage deal_stage DEFAULT 'lead',
    priority deal_priority DEFAULT 'medium',
    value DECIMAL(15, 2),         -- Deal value in PLN
    probability INTEGER DEFAULT 0, -- Win probability 0-100
    expected_close_date DATE,
    actual_close_date DATE,
    lost_reason VARCHAR(255),     -- If stage = lost
    modules_interested TEXT[],    -- Array of module codes interested in
    employee_count_estimate INTEGER, -- How many users they might need
    notes TEXT,
    assigned_sales_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CRM Activities (Calls, Emails, Meetings, Notes)
-- =============================================
CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_type activity_type NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    crm_company_id UUID REFERENCES crm_companies(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ,     -- For tasks/meetings
    completed_at TIMESTAMPTZ,
    is_completed BOOLEAN DEFAULT FALSE,
    duration_minutes INTEGER,     -- For calls/meetings
    outcome VARCHAR(255),         -- Result of the activity
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_crm_companies_assigned ON crm_companies(assigned_sales_id);
CREATE INDEX idx_crm_companies_status ON crm_companies(status);
CREATE INDEX idx_crm_contacts_company ON crm_contacts(crm_company_id);
CREATE INDEX idx_crm_deals_company ON crm_deals(crm_company_id);
CREATE INDEX idx_crm_deals_stage ON crm_deals(stage);
CREATE INDEX idx_crm_deals_assigned ON crm_deals(assigned_sales_id);
CREATE INDEX idx_crm_activities_company ON crm_activities(crm_company_id);
CREATE INDEX idx_crm_activities_deal ON crm_activities(deal_id);
CREATE INDEX idx_crm_activities_type ON crm_activities(activity_type);

-- =============================================
-- Triggers for updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_crm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crm_companies_updated_at
    BEFORE UPDATE ON crm_companies
    FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

CREATE TRIGGER crm_contacts_updated_at
    BEFORE UPDATE ON crm_contacts
    FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

CREATE TRIGGER crm_deals_updated_at
    BEFORE UPDATE ON crm_deals
    FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

CREATE TRIGGER crm_activities_updated_at
    BEFORE UPDATE ON crm_activities
    FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();
