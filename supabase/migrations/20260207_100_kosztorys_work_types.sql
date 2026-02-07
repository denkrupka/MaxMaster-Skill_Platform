-- Миграция для создания таблицы kosztorys_work_types (Rodzaj prac)
-- Эта таблица заменяет захардкоженные installation_types и позволяет создавать multi-select

-- Таблица типов работ
CREATE TABLE IF NOT EXISTS kosztorys_work_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_kosztorys_work_types_company_id ON kosztorys_work_types(company_id);
CREATE INDEX IF NOT EXISTS idx_kosztorys_work_types_is_active ON kosztorys_work_types(is_active);
CREATE INDEX IF NOT EXISTS idx_kosztorys_work_types_sort_order ON kosztorys_work_types(sort_order);

-- RLS политики
ALTER TABLE kosztorys_work_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view work types from their company" ON kosztorys_work_types
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Company admins can manage work types" ON kosztorys_work_types
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE id = auth.uid()
      AND role IN ('company_admin', 'hr', 'coordinator')
    )
  );

-- Связующая таблица для многоуровневого выбора типов работ в запросе
CREATE TABLE IF NOT EXISTS kosztorys_request_work_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES kosztorys_requests(id) ON DELETE CASCADE,
  work_type_id UUID NOT NULL REFERENCES kosztorys_work_types(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, work_type_id)
);

-- Индексы для связующей таблицы
CREATE INDEX IF NOT EXISTS idx_kosztorys_request_work_types_request_id ON kosztorys_request_work_types(request_id);
CREATE INDEX IF NOT EXISTS idx_kosztorys_request_work_types_work_type_id ON kosztorys_request_work_types(work_type_id);

-- RLS для связующей таблицы
ALTER TABLE kosztorys_request_work_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view request work types" ON kosztorys_request_work_types
  FOR SELECT USING (
    request_id IN (
      SELECT id FROM kosztorys_requests
      WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can manage request work types" ON kosztorys_request_work_types
  FOR ALL USING (
    request_id IN (
      SELECT id FROM kosztorys_requests
      WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    )
  );

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_kosztorys_work_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_kosztorys_work_types_updated_at
  BEFORE UPDATE ON kosztorys_work_types
  FOR EACH ROW EXECUTE FUNCTION update_kosztorys_work_types_updated_at();

-- Seed данные (стандартные типы работ)
-- Эти данные будут вставлены для каждой компании через функцию или при регистрации
