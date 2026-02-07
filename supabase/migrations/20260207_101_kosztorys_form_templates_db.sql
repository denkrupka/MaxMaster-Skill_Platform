-- Миграция для создания таблиц формуляров
-- Позволяет редактировать структуру формуляров через UI вместо захардкоженных FORM_TEMPLATES

-- Шаблоны формуляров (основная таблица)
CREATE TABLE IF NOT EXISTS kosztorys_form_templates_db (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  form_type VARCHAR(50) NOT NULL, -- 'MIESZK-IE', 'MIESZK-IT', 'PREM-IE', 'PREM-IT'
  title VARCHAR(255) NOT NULL,
  object_type VARCHAR(50), -- для какого типа объекта
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, form_type)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_kosztorys_form_templates_db_company_id ON kosztorys_form_templates_db(company_id);
CREATE INDEX IF NOT EXISTS idx_kosztorys_form_templates_db_form_type ON kosztorys_form_templates_db(form_type);
CREATE INDEX IF NOT EXISTS idx_kosztorys_form_templates_db_is_active ON kosztorys_form_templates_db(is_active);

-- RLS политики
ALTER TABLE kosztorys_form_templates_db ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view form templates from their company" ON kosztorys_form_templates_db
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Company admins can manage form templates" ON kosztorys_form_templates_db
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE id = auth.uid()
      AND role IN ('company_admin', 'hr', 'coordinator')
    )
  );

-- Группы помещений в шаблоне
CREATE TABLE IF NOT EXISTS kosztorys_form_room_groups_db (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES kosztorys_form_templates_db(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(20) DEFAULT '#f59e0b', -- цвет для выделения группы
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, code)
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_form_room_groups_db_template_id ON kosztorys_form_room_groups_db(template_id);
CREATE INDEX IF NOT EXISTS idx_kosztorys_form_room_groups_db_sort_order ON kosztorys_form_room_groups_db(sort_order);

ALTER TABLE kosztorys_form_room_groups_db ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view room groups" ON kosztorys_form_room_groups_db
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM kosztorys_form_templates_db
      WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Company admins can manage room groups" ON kosztorys_form_room_groups_db
  FOR ALL USING (
    template_id IN (
      SELECT id FROM kosztorys_form_templates_db
      WHERE company_id IN (
        SELECT company_id FROM users
        WHERE id = auth.uid()
        AND role IN ('company_admin', 'hr', 'coordinator')
      )
    )
  );

-- Помещения/элементы в группе
CREATE TABLE IF NOT EXISTS kosztorys_form_rooms_db (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES kosztorys_form_room_groups_db(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, code)
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_form_rooms_db_group_id ON kosztorys_form_rooms_db(group_id);
CREATE INDEX IF NOT EXISTS idx_kosztorys_form_rooms_db_sort_order ON kosztorys_form_rooms_db(sort_order);

ALTER TABLE kosztorys_form_rooms_db ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rooms" ON kosztorys_form_rooms_db
  FOR SELECT USING (
    group_id IN (
      SELECT id FROM kosztorys_form_room_groups_db
      WHERE template_id IN (
        SELECT id FROM kosztorys_form_templates_db
        WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Company admins can manage rooms" ON kosztorys_form_rooms_db
  FOR ALL USING (
    group_id IN (
      SELECT id FROM kosztorys_form_room_groups_db
      WHERE template_id IN (
        SELECT id FROM kosztorys_form_templates_db
        WHERE company_id IN (
          SELECT company_id FROM users
          WHERE id = auth.uid()
          AND role IN ('company_admin', 'hr', 'coordinator')
        )
      )
    )
  );

-- Категории работ
CREATE TABLE IF NOT EXISTS kosztorys_form_work_categories_db (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES kosztorys_form_templates_db(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(20) DEFAULT '#3b82f6', -- цвет для выделения категории
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, code)
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_form_work_categories_db_template_id ON kosztorys_form_work_categories_db(template_id);
CREATE INDEX IF NOT EXISTS idx_kosztorys_form_work_categories_db_sort_order ON kosztorys_form_work_categories_db(sort_order);

ALTER TABLE kosztorys_form_work_categories_db ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view work categories" ON kosztorys_form_work_categories_db
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM kosztorys_form_templates_db
      WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Company admins can manage work categories" ON kosztorys_form_work_categories_db
  FOR ALL USING (
    template_id IN (
      SELECT id FROM kosztorys_form_templates_db
      WHERE company_id IN (
        SELECT company_id FROM users
        WHERE id = auth.uid()
        AND role IN ('company_admin', 'hr', 'coordinator')
      )
    )
  );

-- Типы работ в категории
CREATE TABLE IF NOT EXISTS kosztorys_form_work_types_db (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES kosztorys_form_work_categories_db(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, code)
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_form_work_types_db_category_id ON kosztorys_form_work_types_db(category_id);
CREATE INDEX IF NOT EXISTS idx_kosztorys_form_work_types_db_sort_order ON kosztorys_form_work_types_db(sort_order);

ALTER TABLE kosztorys_form_work_types_db ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view work types" ON kosztorys_form_work_types_db
  FOR SELECT USING (
    category_id IN (
      SELECT id FROM kosztorys_form_work_categories_db
      WHERE template_id IN (
        SELECT id FROM kosztorys_form_templates_db
        WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Company admins can manage work types" ON kosztorys_form_work_types_db
  FOR ALL USING (
    category_id IN (
      SELECT id FROM kosztorys_form_work_categories_db
      WHERE template_id IN (
        SELECT id FROM kosztorys_form_templates_db
        WHERE company_id IN (
          SELECT company_id FROM users
          WHERE id = auth.uid()
          AND role IN ('company_admin', 'hr', 'coordinator')
        )
      )
    )
  );

-- Общие поля формуляра (выносим в отдельную таблицу)
CREATE TABLE IF NOT EXISTS kosztorys_form_general_fields_db (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES kosztorys_form_templates_db(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  label VARCHAR(255) NOT NULL,
  field_type VARCHAR(20) DEFAULT 'text', -- 'text', 'decimal', 'integer', 'select'
  required BOOLEAN DEFAULT false,
  placeholder VARCHAR(255),
  options JSONB, -- для select типа
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, code)
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_form_general_fields_db_template_id ON kosztorys_form_general_fields_db(template_id);

ALTER TABLE kosztorys_form_general_fields_db ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view general fields" ON kosztorys_form_general_fields_db
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM kosztorys_form_templates_db
      WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Company admins can manage general fields" ON kosztorys_form_general_fields_db
  FOR ALL USING (
    template_id IN (
      SELECT id FROM kosztorys_form_templates_db
      WHERE company_id IN (
        SELECT company_id FROM users
        WHERE id = auth.uid()
        AND role IN ('company_admin', 'hr', 'coordinator')
      )
    )
  );

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_kosztorys_form_templates_db_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_kosztorys_form_templates_db_updated_at
  BEFORE UPDATE ON kosztorys_form_templates_db
  FOR EACH ROW EXECUTE FUNCTION update_kosztorys_form_templates_db_updated_at();
