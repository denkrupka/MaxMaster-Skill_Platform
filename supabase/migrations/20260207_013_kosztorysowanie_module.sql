-- =====================================================
-- МОДУЛЬ KOSZTORYSOWANIE (ELEKTRYKA)
-- Система расчёта электромонтажных работ
-- =====================================================

-- Запросы на расчёт (Zapytania o kosztorys)
CREATE TABLE IF NOT EXISTS kosztorys_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    request_number VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'in_progress', 'form_filled', 'estimate_generated',
                          'estimate_approved', 'estimate_revision', 'kp_sent', 'closed', 'cancelled')),
    client_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    investment_name VARCHAR(500) NOT NULL,
    object_type VARCHAR(30) NOT NULL CHECK (object_type IN ('industrial', 'residential', 'office')),
    installation_types VARCHAR(10) NOT NULL CHECK (installation_types IN ('IE', 'IT', 'IE,IT')),
    address VARCHAR(500),
    planned_response_date DATE,
    notes TEXT,
    request_source VARCHAR(30) CHECK (request_source IN ('email', 'phone', 'meeting', 'tender', 'other')),
    assigned_user_id UUID NOT NULL REFERENCES users(id),
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, request_number)
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_requests_company ON kosztorys_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_kosztorys_requests_status ON kosztorys_requests(status);
CREATE INDEX IF NOT EXISTS idx_kosztorys_requests_assigned ON kosztorys_requests(assigned_user_id);

-- Файлы запроса
CREATE TABLE IF NOT EXISTS kosztorys_request_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES kosztorys_requests(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by_id UUID NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_request_files_request ON kosztorys_request_files(request_id);

-- Формуляры выполняемых работ
CREATE TABLE IF NOT EXISTS kosztorys_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES kosztorys_requests(id) ON DELETE CASCADE,
    form_type VARCHAR(20) NOT NULL CHECK (form_type IN ('PREM-IE', 'PREM-IT', 'MIESZK-IE', 'MIESZK-IT')),
    version INTEGER NOT NULL DEFAULT 1,
    is_current BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')),
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_forms_request ON kosztorys_forms(request_id);
CREATE INDEX IF NOT EXISTS idx_kosztorys_forms_type ON kosztorys_forms(form_type);

-- Общие данные формуляра (шапка)
CREATE TABLE IF NOT EXISTS kosztorys_form_general_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES kosztorys_forms(id) ON DELETE CASCADE UNIQUE,
    hall_area DECIMAL(10,2),
    office_area DECIMAL(10,2),
    apartments_count VARCHAR(255),
    ext_wall_type VARCHAR(100),
    int_wall_type VARCHAR(100),
    hall_ceiling_height DECIMAL(5,2),
    office_ceiling_height DECIMAL(5,2),
    ceiling_height DECIMAL(5,2),
    consumable_material VARCHAR(255)
);

-- Отметки в матрице формуляра
CREATE TABLE IF NOT EXISTS kosztorys_form_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES kosztorys_forms(id) ON DELETE CASCADE,
    room_code VARCHAR(100) NOT NULL,
    room_group VARCHAR(100) NOT NULL,
    work_type_code VARCHAR(100) NOT NULL,
    work_category VARCHAR(100) NOT NULL,
    is_marked BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (form_id, room_code, work_type_code)
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_form_answers_form ON kosztorys_form_answers(form_id);

-- Справочник видов работ
CREATE TABLE IF NOT EXISTS kosztorys_work_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(500) NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(200),
    unit_id INTEGER REFERENCES unit_measures(id),
    task_description TEXT,
    expected_result TEXT,
    labor_hours_per_unit DECIMAL(8,4),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, code)
);

-- Справочник материалов
CREATE TABLE IF NOT EXISTS kosztorys_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(500) NOT NULL,
    category VARCHAR(200),
    manufacturer VARCHAR(200),
    unit_id INTEGER REFERENCES unit_measures(id),
    material_type VARCHAR(20) NOT NULL DEFAULT 'main' CHECK (material_type IN ('main', 'minor', 'consumable')),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, code)
);

-- Справочник техники
CREATE TABLE IF NOT EXISTS kosztorys_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(500) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('machines', 'tools')),
    unit_id INTEGER REFERENCES unit_measures(id),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, code)
);

-- Шаблонные задания
CREATE TABLE IF NOT EXISTS kosztorys_template_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(500) NOT NULL,
    work_type_id UUID REFERENCES kosztorys_work_types(id),
    unit_id INTEGER REFERENCES unit_measures(id),
    labor_hours DECIMAL(8,4),
    expected_result TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, code)
);

-- Материалы в шаблонном задании
CREATE TABLE IF NOT EXISTS kosztorys_template_task_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_task_id UUID NOT NULL REFERENCES kosztorys_template_tasks(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES kosztorys_materials(id),
    quantity_coefficient DECIMAL(8,4) NOT NULL DEFAULT 1.0
);

-- Техника в шаблонном задании
CREATE TABLE IF NOT EXISTS kosztorys_template_task_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_task_id UUID NOT NULL REFERENCES kosztorys_template_tasks(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES kosztorys_equipment(id),
    quantity_coefficient DECIMAL(8,4) NOT NULL DEFAULT 1.0
);

-- Правила маппинга (формуляр → шаблонное задание)
CREATE TABLE IF NOT EXISTS kosztorys_mapping_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    form_type VARCHAR(20) NOT NULL,
    room_code VARCHAR(100) NOT NULL,
    room_group VARCHAR(100) NOT NULL,
    work_type_code VARCHAR(100) NOT NULL,
    work_category VARCHAR(100) NOT NULL,
    template_task_id UUID NOT NULL REFERENCES kosztorys_template_tasks(id),
    coefficient DECIMAL(8,4) NOT NULL DEFAULT 1.0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, form_type, room_code, work_type_code)
);

-- Прайс-листы
CREATE TABLE IF NOT EXISTS kosztorys_price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Позиции прайс-листа
CREATE TABLE IF NOT EXISTS kosztorys_price_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_list_id UUID NOT NULL REFERENCES kosztorys_price_lists(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('work', 'material', 'equipment')),
    item_id UUID NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    UNIQUE (price_list_id, item_type, item_id)
);

-- Сметы
CREATE TABLE IF NOT EXISTS kosztorys_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES kosztorys_requests(id) ON DELETE CASCADE,
    form_id UUID NOT NULL REFERENCES kosztorys_forms(id),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    estimate_number VARCHAR(30) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
    vat_rate DECIMAL(5,2) NOT NULL DEFAULT 23.00,
    total_works DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_materials DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_equipment DECIMAL(15,2) NOT NULL DEFAULT 0,
    subtotal_net DECIMAL(15,2) NOT NULL DEFAULT 0,
    vat_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_gross DECIMAL(15,2) NOT NULL DEFAULT 0,
    approved_by_id UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, estimate_number)
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_estimates_request ON kosztorys_estimates(request_id);
CREATE INDEX IF NOT EXISTS idx_kosztorys_estimates_company ON kosztorys_estimates(company_id);

-- Позиции сметы
CREATE TABLE IF NOT EXISTS kosztorys_estimate_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id UUID NOT NULL REFERENCES kosztorys_estimates(id) ON DELETE CASCADE,
    position_number INTEGER NOT NULL,
    room_group VARCHAR(200) NOT NULL,
    installation_element VARCHAR(200) NOT NULL,
    task_description VARCHAR(500) NOT NULL,
    material_name VARCHAR(500),
    unit_id INTEGER REFERENCES unit_measures(id),
    quantity DECIMAL(10,2) DEFAULT 0,
    unit_price_work DECIMAL(10,2) DEFAULT 0,
    total_work DECIMAL(15,2) DEFAULT 0,
    unit_price_material DECIMAL(10,2) DEFAULT 0,
    total_material DECIMAL(15,2) DEFAULT 0,
    total_item DECIMAL(15,2) DEFAULT 0,
    expected_result TEXT,
    source VARCHAR(20) NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
    template_task_id UUID REFERENCES kosztorys_template_tasks(id),
    mapping_rule_id UUID REFERENCES kosztorys_mapping_rules(id),
    price_deviation_reason TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_estimate_items_estimate ON kosztorys_estimate_items(estimate_id);

-- Техника в смете
CREATE TABLE IF NOT EXISTS kosztorys_estimate_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id UUID NOT NULL REFERENCES kosztorys_estimates(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES kosztorys_equipment(id),
    unit_id INTEGER REFERENCES unit_measures(id),
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total DECIMAL(15,2) NOT NULL
);

-- Коммерческие предложения (KP)
CREATE TABLE IF NOT EXISTS kosztorys_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES kosztorys_requests(id) ON DELETE CASCADE,
    estimate_id UUID NOT NULL REFERENCES kosztorys_estimates(id),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    kp_number VARCHAR(30) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    detail_level VARCHAR(20) NOT NULL DEFAULT 'aggregated'
        CHECK (detail_level IN ('detailed', 'aggregated', 'minimal')),
    file_path_pdf VARCHAR(500),
    file_path_xlsx VARCHAR(500),
    file_path_docx VARCHAR(500),
    validity_days INTEGER NOT NULL DEFAULT 30,
    payment_terms TEXT,
    execution_terms TEXT,
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    client_response TEXT,
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, kp_number)
);

CREATE INDEX IF NOT EXISTS idx_kosztorys_proposals_request ON kosztorys_proposals(request_id);
CREATE INDEX IF NOT EXISTS idx_kosztorys_proposals_estimate ON kosztorys_proposals(estimate_id);

-- RLS Policies
ALTER TABLE kosztorys_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_request_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_form_general_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_form_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_work_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_template_task_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_template_task_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_mapping_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_estimate_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE kosztorys_proposals ENABLE ROW LEVEL SECURITY;

-- Политики для kosztorys_requests
CREATE POLICY "kosztorys_requests_select" ON kosztorys_requests FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "kosztorys_requests_insert" ON kosztorys_requests FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "kosztorys_requests_update" ON kosztorys_requests FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "kosztorys_requests_delete" ON kosztorys_requests FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Политики для kosztorys_forms
CREATE POLICY "kosztorys_forms_select" ON kosztorys_forms FOR SELECT
    USING (request_id IN (SELECT id FROM kosztorys_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY "kosztorys_forms_insert" ON kosztorys_forms FOR INSERT
    WITH CHECK (request_id IN (SELECT id FROM kosztorys_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY "kosztorys_forms_update" ON kosztorys_forms FOR UPDATE
    USING (request_id IN (SELECT id FROM kosztorys_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY "kosztorys_forms_delete" ON kosztorys_forms FOR DELETE
    USING (request_id IN (SELECT id FROM kosztorys_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

-- Политики для kosztorys_form_general_data
CREATE POLICY "kosztorys_form_general_data_all" ON kosztorys_form_general_data FOR ALL
    USING (form_id IN (SELECT id FROM kosztorys_forms WHERE request_id IN
        (SELECT id FROM kosztorys_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))));

-- Политики для kosztorys_form_answers
CREATE POLICY "kosztorys_form_answers_all" ON kosztorys_form_answers FOR ALL
    USING (form_id IN (SELECT id FROM kosztorys_forms WHERE request_id IN
        (SELECT id FROM kosztorys_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))));

-- Политики для справочников (work_types, materials, equipment, template_tasks, mapping_rules)
CREATE POLICY "kosztorys_work_types_all" ON kosztorys_work_types FOR ALL
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "kosztorys_materials_all" ON kosztorys_materials FOR ALL
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "kosztorys_equipment_all" ON kosztorys_equipment FOR ALL
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "kosztorys_template_tasks_all" ON kosztorys_template_tasks FOR ALL
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "kosztorys_template_task_materials_all" ON kosztorys_template_task_materials FOR ALL
    USING (template_task_id IN (SELECT id FROM kosztorys_template_tasks WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY "kosztorys_template_task_equipment_all" ON kosztorys_template_task_equipment FOR ALL
    USING (template_task_id IN (SELECT id FROM kosztorys_template_tasks WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY "kosztorys_mapping_rules_all" ON kosztorys_mapping_rules FOR ALL
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "kosztorys_price_lists_all" ON kosztorys_price_lists FOR ALL
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "kosztorys_price_list_items_all" ON kosztorys_price_list_items FOR ALL
    USING (price_list_id IN (SELECT id FROM kosztorys_price_lists WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

-- Политики для estimates
CREATE POLICY "kosztorys_estimates_all" ON kosztorys_estimates FOR ALL
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "kosztorys_estimate_items_all" ON kosztorys_estimate_items FOR ALL
    USING (estimate_id IN (SELECT id FROM kosztorys_estimates WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY "kosztorys_estimate_equipment_all" ON kosztorys_estimate_equipment FOR ALL
    USING (estimate_id IN (SELECT id FROM kosztorys_estimates WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

-- Политики для proposals
CREATE POLICY "kosztorys_proposals_all" ON kosztorys_proposals FOR ALL
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Политики для request_files
CREATE POLICY "kosztorys_request_files_all" ON kosztorys_request_files FOR ALL
    USING (request_id IN (SELECT id FROM kosztorys_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

-- Триггер обновления updated_at
CREATE OR REPLACE FUNCTION update_kosztorys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_kosztorys_requests_updated
    BEFORE UPDATE ON kosztorys_requests
    FOR EACH ROW EXECUTE FUNCTION update_kosztorys_updated_at();

CREATE TRIGGER tr_kosztorys_forms_updated
    BEFORE UPDATE ON kosztorys_forms
    FOR EACH ROW EXECUTE FUNCTION update_kosztorys_updated_at();

CREATE TRIGGER tr_kosztorys_estimates_updated
    BEFORE UPDATE ON kosztorys_estimates
    FOR EACH ROW EXECUTE FUNCTION update_kosztorys_updated_at();

CREATE TRIGGER tr_kosztorys_estimate_items_updated
    BEFORE UPDATE ON kosztorys_estimate_items
    FOR EACH ROW EXECUTE FUNCTION update_kosztorys_updated_at();
