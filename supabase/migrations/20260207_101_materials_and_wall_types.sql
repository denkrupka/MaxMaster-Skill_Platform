-- Миграция для добавления полей материалов и словаря типов стен

-- Добавляем колонки материалов в таблицу запросов
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kosztorys_requests' AND column_name = 'main_material_side'
  ) THEN
    ALTER TABLE kosztorys_requests ADD COLUMN main_material_side VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kosztorys_requests' AND column_name = 'minor_material_side'
  ) THEN
    ALTER TABLE kosztorys_requests ADD COLUMN minor_material_side VARCHAR(50);
  END IF;
END $$;

-- Словарь типов стен
CREATE TABLE IF NOT EXISTS kosztorys_wall_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  wall_category VARCHAR(20) NOT NULL CHECK (wall_category IN ('external', 'internal')),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, wall_category, code)
);

-- Индексы для словаря стен
CREATE INDEX IF NOT EXISTS idx_kosztorys_wall_types_company_id ON kosztorys_wall_types(company_id);
CREATE INDEX IF NOT EXISTS idx_kosztorys_wall_types_category ON kosztorys_wall_types(wall_category);

-- RLS для словаря стен
ALTER TABLE kosztorys_wall_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view wall types" ON kosztorys_wall_types;
DROP POLICY IF EXISTS "Users can manage wall types" ON kosztorys_wall_types;

CREATE POLICY "Users can view wall types" ON kosztorys_wall_types
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can manage wall types" ON kosztorys_wall_types
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );
