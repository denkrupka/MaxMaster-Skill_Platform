-- =====================================================
-- CUSTOM CATALOG EXTENDED
-- Extends kosztorys_materials with wholesaler/pricing
-- fields and adds custom lookup tables for categories,
-- manufacturers, and units.
-- =====================================================

-- =====================================================
-- 1. Add new columns to kosztorys_materials
-- =====================================================

-- Always-new columns (unconditional ALTER TABLE)
ALTER TABLE public.kosztorys_materials
  ADD COLUMN IF NOT EXISTS ean VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS sku VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS catalog_price DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_wholesaler VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS source_wholesaler_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS price_sync_mode VARCHAR(10) DEFAULT 'fixed';

-- Add CHECK constraint for source_wholesaler
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kosztorys_materials_source_wholesaler_check'
      AND conrelid = 'public.kosztorys_materials'::regclass
  ) THEN
    ALTER TABLE public.kosztorys_materials
      ADD CONSTRAINT kosztorys_materials_source_wholesaler_check
      CHECK (source_wholesaler IN ('tim', 'oninen') OR source_wholesaler IS NULL);
  END IF;
END $$;

-- Add CHECK constraint for price_sync_mode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kosztorys_materials_price_sync_mode_check'
      AND conrelid = 'public.kosztorys_materials'::regclass
  ) THEN
    ALTER TABLE public.kosztorys_materials
      ADD CONSTRAINT kosztorys_materials_price_sync_mode_check
      CHECK (price_sync_mode IN ('fixed', 'synced'));
  END IF;
END $$;

-- Conditionally add 'unit' column (in case it was added by a previous migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kosztorys_materials'
      AND column_name = 'unit'
  ) THEN
    ALTER TABLE public.kosztorys_materials ADD COLUMN unit VARCHAR(50) NULL;
  END IF;
END $$;

-- Conditionally add 'default_price' column (in case it was added by a previous migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kosztorys_materials'
      AND column_name = 'default_price'
  ) THEN
    ALTER TABLE public.kosztorys_materials ADD COLUMN default_price DECIMAL(10,2) NULL;
  END IF;
END $$;

-- =====================================================
-- 2. kosztorys_custom_categories
-- =====================================================

CREATE TABLE IF NOT EXISTS public.kosztorys_custom_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

ALTER TABLE public.kosztorys_custom_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_custom_categories'
      AND policyname = 'kosztorys_custom_categories_select'
  ) THEN
    CREATE POLICY "kosztorys_custom_categories_select"
      ON public.kosztorys_custom_categories FOR SELECT
      USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_custom_categories'
      AND policyname = 'kosztorys_custom_categories_all'
  ) THEN
    CREATE POLICY "kosztorys_custom_categories_all"
      ON public.kosztorys_custom_categories FOR ALL
      USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

-- =====================================================
-- 3. kosztorys_custom_manufacturers
-- =====================================================

CREATE TABLE IF NOT EXISTS public.kosztorys_custom_manufacturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

ALTER TABLE public.kosztorys_custom_manufacturers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_custom_manufacturers'
      AND policyname = 'kosztorys_custom_manufacturers_select'
  ) THEN
    CREATE POLICY "kosztorys_custom_manufacturers_select"
      ON public.kosztorys_custom_manufacturers FOR SELECT
      USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_custom_manufacturers'
      AND policyname = 'kosztorys_custom_manufacturers_all'
  ) THEN
    CREATE POLICY "kosztorys_custom_manufacturers_all"
      ON public.kosztorys_custom_manufacturers FOR ALL
      USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

-- =====================================================
-- 4. kosztorys_custom_units
-- =====================================================

CREATE TABLE IF NOT EXISTS public.kosztorys_custom_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  value VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, value)
);

ALTER TABLE public.kosztorys_custom_units ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_custom_units'
      AND policyname = 'kosztorys_custom_units_select'
  ) THEN
    CREATE POLICY "kosztorys_custom_units_select"
      ON public.kosztorys_custom_units FOR SELECT
      USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_custom_units'
      AND policyname = 'kosztorys_custom_units_all'
  ) THEN
    CREATE POLICY "kosztorys_custom_units_all"
      ON public.kosztorys_custom_units FOR ALL
      USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;
