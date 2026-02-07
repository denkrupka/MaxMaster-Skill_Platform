-- Простая таблица для хранения шаблонов формуляров как JSON
-- Позволяет сохранять кастомные шаблоны прямо из UI

CREATE TABLE IF NOT EXISTS kosztorys_form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  form_type VARCHAR(50) NOT NULL, -- 'MIESZK-IE', 'MIESZK-IT', 'PREM-IE', 'PREM-IT' или кастомный
  object_type VARCHAR(50), -- 'industrial', 'residential', 'office'
  work_type VARCHAR(50), -- 'IE', 'IT'
  template_data JSONB NOT NULL, -- полная структура шаблона
  is_active BOOLEAN DEFAULT true,
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_kosztorys_form_templates_company_id ON kosztorys_form_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_kosztorys_form_templates_form_type ON kosztorys_form_templates(form_type);
CREATE INDEX IF NOT EXISTS idx_kosztorys_form_templates_object_type ON kosztorys_form_templates(object_type);
CREATE INDEX IF NOT EXISTS idx_kosztorys_form_templates_work_type ON kosztorys_form_templates(work_type);
CREATE INDEX IF NOT EXISTS idx_kosztorys_form_templates_is_active ON kosztorys_form_templates(is_active);

-- RLS политики
ALTER TABLE kosztorys_form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view form templates from their company" ON kosztorys_form_templates
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Company admins can insert form templates" ON kosztorys_form_templates
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM users
      WHERE id = auth.uid()
      AND role IN ('company_admin', 'hr', 'coordinator')
    )
  );

CREATE POLICY "Company admins can update form templates" ON kosztorys_form_templates
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE id = auth.uid()
      AND role IN ('company_admin', 'hr', 'coordinator')
    )
  );

CREATE POLICY "Company admins can delete form templates" ON kosztorys_form_templates
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE id = auth.uid()
      AND role IN ('company_admin', 'hr', 'coordinator')
    )
  );

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_kosztorys_form_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_kosztorys_form_templates_updated_at ON kosztorys_form_templates;
CREATE TRIGGER trigger_kosztorys_form_templates_updated_at
  BEFORE UPDATE ON kosztorys_form_templates
  FOR EACH ROW EXECUTE FUNCTION update_kosztorys_form_templates_updated_at();
