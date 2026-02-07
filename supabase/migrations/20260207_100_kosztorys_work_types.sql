-- Миграция для расширения таблицы kosztorys_work_types (Rodzaj prac)
-- Добавляет sort_order если не существует, и создает связующую таблицу

-- Добавляем колонку sort_order если её нет
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kosztorys_work_types' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE kosztorys_work_types ADD COLUMN sort_order INTEGER DEFAULT 0;
  END IF;
END $$;

-- Индекс для sort_order (если не существует)
CREATE INDEX IF NOT EXISTS idx_kosztorys_work_types_sort_order ON kosztorys_work_types(sort_order);

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

-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "Users can view request work types" ON kosztorys_request_work_types;
DROP POLICY IF EXISTS "Users can manage request work types" ON kosztorys_request_work_types;

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
