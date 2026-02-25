-- =====================================================
-- LABOUR CATALOG TABLES
-- System catalog (read-only, seeded from Excel) and
-- Own catalog (per company, with material/equipment bindings)
-- =====================================================

-- =====================================================
-- 1. kosztorys_system_labour_categories
--    Hierarchical categories for the system labour catalog
-- =====================================================
CREATE TABLE IF NOT EXISTS public.kosztorys_system_labour_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  number VARCHAR(50),
  path VARCHAR(500),
  parent_id UUID REFERENCES public.kosztorys_system_labour_categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  depth INTEGER DEFAULT 0
);

ALTER TABLE public.kosztorys_system_labour_categories ENABLE ROW LEVEL SECURITY;

-- System catalog is readable by all authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_system_labour_categories'
      AND policyname = 'kosztorys_system_labour_categories_select'
  ) THEN
    CREATE POLICY "kosztorys_system_labour_categories_select"
      ON public.kosztorys_system_labour_categories FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- =====================================================
-- 2. kosztorys_system_labours
--    System labour catalog (2537 rows from Excel)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.kosztorys_system_labours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id INTEGER,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(500) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  description TEXT,
  comments TEXT,
  pkwiu VARCHAR(20),
  price_unit DECIMAL(10,2),
  category_id INTEGER,
  category_name VARCHAR(255),
  category_number VARCHAR(50),
  category_path VARCHAR(500),
  tags TEXT,
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE public.kosztorys_system_labours ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_system_labours'
      AND policyname = 'kosztorys_system_labours_select'
  ) THEN
    CREATE POLICY "kosztorys_system_labours_select"
      ON public.kosztorys_system_labours FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Index for category filtering and search
CREATE INDEX IF NOT EXISTS idx_system_labours_category_path ON public.kosztorys_system_labours(category_path);
CREATE INDEX IF NOT EXISTS idx_system_labours_name ON public.kosztorys_system_labours USING gin(to_tsvector('simple', name));

-- =====================================================
-- 3. kosztorys_own_labour_categories
--    Per-company hierarchical categories for own labours
-- =====================================================
CREATE TABLE IF NOT EXISTS public.kosztorys_own_labour_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  parent_id UUID REFERENCES public.kosztorys_own_labour_categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

ALTER TABLE public.kosztorys_own_labour_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_own_labour_categories'
      AND policyname = 'kosztorys_own_labour_categories_select'
  ) THEN
    CREATE POLICY "kosztorys_own_labour_categories_select"
      ON public.kosztorys_own_labour_categories FOR SELECT
      USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_own_labour_categories'
      AND policyname = 'kosztorys_own_labour_categories_all'
  ) THEN
    CREATE POLICY "kosztorys_own_labour_categories_all"
      ON public.kosztorys_own_labour_categories FOR ALL
      USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

-- =====================================================
-- 4. kosztorys_own_labours
--    Per-company own labour catalog
-- =====================================================
CREATE TABLE IF NOT EXISTS public.kosztorys_own_labours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(500) NOT NULL,
  unit VARCHAR(50),
  price DECIMAL(10,2),
  time_hours INTEGER DEFAULT 0,
  time_minutes INTEGER DEFAULT 0,
  cost_type VARCHAR(10) DEFAULT 'rg',
  cost_ryczalt DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  category VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

ALTER TABLE public.kosztorys_own_labours ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_own_labours'
      AND policyname = 'kosztorys_own_labours_select'
  ) THEN
    CREATE POLICY "kosztorys_own_labours_select"
      ON public.kosztorys_own_labours FOR SELECT
      USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_own_labours'
      AND policyname = 'kosztorys_own_labours_all'
  ) THEN
    CREATE POLICY "kosztorys_own_labours_all"
      ON public.kosztorys_own_labours FOR ALL
      USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

-- Check constraint for cost_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kosztorys_own_labours_cost_type_check'
      AND conrelid = 'public.kosztorys_own_labours'::regclass
  ) THEN
    ALTER TABLE public.kosztorys_own_labours
      ADD CONSTRAINT kosztorys_own_labours_cost_type_check
      CHECK (cost_type IN ('rg', 'ryczalt'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_own_labours_company ON public.kosztorys_own_labours(company_id);
CREATE INDEX IF NOT EXISTS idx_own_labours_category ON public.kosztorys_own_labours(category);

-- =====================================================
-- 5. kosztorys_own_labour_materials
--    Materials linked to own labours
-- =====================================================
CREATE TABLE IF NOT EXISTS public.kosztorys_own_labour_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  labour_id UUID NOT NULL REFERENCES public.kosztorys_own_labours(id) ON DELETE CASCADE,
  material_name VARCHAR(500),
  material_price DECIMAL(10,2),
  material_quantity DECIMAL(10,4) DEFAULT 1,
  source_material_id UUID,
  source_wholesaler VARCHAR(50),
  source_sku VARCHAR(100),
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.kosztorys_own_labour_materials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_own_labour_materials'
      AND policyname = 'kosztorys_own_labour_materials_select'
  ) THEN
    CREATE POLICY "kosztorys_own_labour_materials_select"
      ON public.kosztorys_own_labour_materials FOR SELECT
      USING (labour_id IN (
        SELECT id FROM public.kosztorys_own_labours
        WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_own_labour_materials'
      AND policyname = 'kosztorys_own_labour_materials_all'
  ) THEN
    CREATE POLICY "kosztorys_own_labour_materials_all"
      ON public.kosztorys_own_labour_materials FOR ALL
      USING (labour_id IN (
        SELECT id FROM public.kosztorys_own_labours
        WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_own_labour_materials_labour ON public.kosztorys_own_labour_materials(labour_id);

-- =====================================================
-- 6. kosztorys_own_labour_equipment
--    Equipment linked to own labours
-- =====================================================
CREATE TABLE IF NOT EXISTS public.kosztorys_own_labour_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  labour_id UUID NOT NULL REFERENCES public.kosztorys_own_labours(id) ON DELETE CASCADE,
  equipment_name VARCHAR(500),
  equipment_price DECIMAL(10,2),
  equipment_quantity DECIMAL(10,4) DEFAULT 1,
  source_equipment_id UUID,
  source_wholesaler VARCHAR(50),
  source_sku VARCHAR(100),
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.kosztorys_own_labour_equipment ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_own_labour_equipment'
      AND policyname = 'kosztorys_own_labour_equipment_select'
  ) THEN
    CREATE POLICY "kosztorys_own_labour_equipment_select"
      ON public.kosztorys_own_labour_equipment FOR SELECT
      USING (labour_id IN (
        SELECT id FROM public.kosztorys_own_labours
        WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_own_labour_equipment'
      AND policyname = 'kosztorys_own_labour_equipment_all'
  ) THEN
    CREATE POLICY "kosztorys_own_labour_equipment_all"
      ON public.kosztorys_own_labour_equipment FOR ALL
      USING (labour_id IN (
        SELECT id FROM public.kosztorys_own_labours
        WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_own_labour_equipment_labour ON public.kosztorys_own_labour_equipment(labour_id);
