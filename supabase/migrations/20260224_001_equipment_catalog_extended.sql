-- =====================================================
-- EQUIPMENT CATALOG EXTENDED
-- Extends kosztorys_equipment with wholesaler/pricing
-- fields (mirroring materials catalog) and adds
-- equipment-specific categories table.
-- =====================================================

-- =====================================================
-- 1. Drop the old category CHECK constraint (machines/tools only)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kosztorys_equipment_category_check'
      AND conrelid = 'public.kosztorys_equipment'::regclass
  ) THEN
    ALTER TABLE public.kosztorys_equipment
      DROP CONSTRAINT kosztorys_equipment_category_check;
  END IF;
END $$;

-- Make category nullable and text-based (was enum-like)
ALTER TABLE public.kosztorys_equipment
  ALTER COLUMN category DROP NOT NULL;

ALTER TABLE public.kosztorys_equipment
  ALTER COLUMN category TYPE VARCHAR(255);

-- =====================================================
-- 2. Add new columns to kosztorys_equipment
-- =====================================================
ALTER TABLE public.kosztorys_equipment
  ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS default_price DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_wholesaler VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS source_wholesaler_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS price_sync_mode VARCHAR(10) DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS ean VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS sku VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS ref_num VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS catalog_price DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(10,2) NULL;

-- Conditionally add 'unit' text column (some installs may already have unit_id only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kosztorys_equipment'
      AND column_name = 'unit'
  ) THEN
    ALTER TABLE public.kosztorys_equipment ADD COLUMN unit VARCHAR(50) NULL;
  END IF;
END $$;

-- Add CHECK constraint for source_wholesaler
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kosztorys_equipment_source_wholesaler_check'
      AND conrelid = 'public.kosztorys_equipment'::regclass
  ) THEN
    ALTER TABLE public.kosztorys_equipment
      ADD CONSTRAINT kosztorys_equipment_source_wholesaler_check
      CHECK (source_wholesaler IN ('tim', 'oninen', 'atut-rental', 'ramirent', 'speckable') OR source_wholesaler IS NULL);
  END IF;
END $$;

-- Add CHECK constraint for price_sync_mode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kosztorys_equipment_price_sync_mode_check'
      AND conrelid = 'public.kosztorys_equipment'::regclass
  ) THEN
    ALTER TABLE public.kosztorys_equipment
      ADD CONSTRAINT kosztorys_equipment_price_sync_mode_check
      CHECK (price_sync_mode IN ('fixed', 'synced'));
  END IF;
END $$;

-- =====================================================
-- 3. kosztorys_equipment_categories
-- =====================================================
CREATE TABLE IF NOT EXISTS public.kosztorys_equipment_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  parent_id UUID REFERENCES public.kosztorys_equipment_categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

ALTER TABLE public.kosztorys_equipment_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_equipment_categories'
      AND policyname = 'kosztorys_equipment_categories_select'
  ) THEN
    CREATE POLICY "kosztorys_equipment_categories_select"
      ON public.kosztorys_equipment_categories FOR SELECT
      USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kosztorys_equipment_categories'
      AND policyname = 'kosztorys_equipment_categories_all'
  ) THEN
    CREATE POLICY "kosztorys_equipment_categories_all"
      ON public.kosztorys_equipment_categories FOR ALL
      USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;
