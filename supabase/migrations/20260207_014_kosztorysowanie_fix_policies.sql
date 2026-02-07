-- =====================================================
-- FIX: Drop existing policies and recreate
-- =====================================================

-- Drop existing policies for kosztorys_requests
DROP POLICY IF EXISTS "kosztorys_requests_select" ON kosztorys_requests;
DROP POLICY IF EXISTS "kosztorys_requests_insert" ON kosztorys_requests;
DROP POLICY IF EXISTS "kosztorys_requests_update" ON kosztorys_requests;
DROP POLICY IF EXISTS "kosztorys_requests_delete" ON kosztorys_requests;

-- Drop existing policies for kosztorys_forms
DROP POLICY IF EXISTS "kosztorys_forms_select" ON kosztorys_forms;
DROP POLICY IF EXISTS "kosztorys_forms_insert" ON kosztorys_forms;
DROP POLICY IF EXISTS "kosztorys_forms_update" ON kosztorys_forms;
DROP POLICY IF EXISTS "kosztorys_forms_delete" ON kosztorys_forms;

-- Drop existing policies for other tables
DROP POLICY IF EXISTS "kosztorys_form_general_data_all" ON kosztorys_form_general_data;
DROP POLICY IF EXISTS "kosztorys_form_answers_all" ON kosztorys_form_answers;
DROP POLICY IF EXISTS "kosztorys_work_types_all" ON kosztorys_work_types;
DROP POLICY IF EXISTS "kosztorys_materials_all" ON kosztorys_materials;
DROP POLICY IF EXISTS "kosztorys_equipment_all" ON kosztorys_equipment;
DROP POLICY IF EXISTS "kosztorys_template_tasks_all" ON kosztorys_template_tasks;
DROP POLICY IF EXISTS "kosztorys_template_task_materials_all" ON kosztorys_template_task_materials;
DROP POLICY IF EXISTS "kosztorys_template_task_equipment_all" ON kosztorys_template_task_equipment;
DROP POLICY IF EXISTS "kosztorys_mapping_rules_all" ON kosztorys_mapping_rules;
DROP POLICY IF EXISTS "kosztorys_price_lists_all" ON kosztorys_price_lists;
DROP POLICY IF EXISTS "kosztorys_price_list_items_all" ON kosztorys_price_list_items;
DROP POLICY IF EXISTS "kosztorys_estimates_all" ON kosztorys_estimates;
DROP POLICY IF EXISTS "kosztorys_estimate_items_all" ON kosztorys_estimate_items;
DROP POLICY IF EXISTS "kosztorys_estimate_equipment_all" ON kosztorys_estimate_equipment;
DROP POLICY IF EXISTS "kosztorys_proposals_all" ON kosztorys_proposals;
DROP POLICY IF EXISTS "kosztorys_request_files_all" ON kosztorys_request_files;

-- Recreate policies for kosztorys_requests
CREATE POLICY "kosztorys_requests_select" ON kosztorys_requests FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "kosztorys_requests_insert" ON kosztorys_requests FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "kosztorys_requests_update" ON kosztorys_requests FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "kosztorys_requests_delete" ON kosztorys_requests FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Policies for kosztorys_forms
CREATE POLICY "kosztorys_forms_select" ON kosztorys_forms FOR SELECT
    USING (request_id IN (SELECT id FROM kosztorys_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY "kosztorys_forms_insert" ON kosztorys_forms FOR INSERT
    WITH CHECK (request_id IN (SELECT id FROM kosztorys_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY "kosztorys_forms_update" ON kosztorys_forms FOR UPDATE
    USING (request_id IN (SELECT id FROM kosztorys_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY "kosztorys_forms_delete" ON kosztorys_forms FOR DELETE
    USING (request_id IN (SELECT id FROM kosztorys_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

-- Policies for kosztorys_form_general_data
CREATE POLICY "kosztorys_form_general_data_all" ON kosztorys_form_general_data FOR ALL
    USING (form_id IN (SELECT id FROM kosztorys_forms WHERE request_id IN
        (SELECT id FROM kosztorys_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))));

-- Policies for kosztorys_form_answers
CREATE POLICY "kosztorys_form_answers_all" ON kosztorys_form_answers FOR ALL
    USING (form_id IN (SELECT id FROM kosztorys_forms WHERE request_id IN
        (SELECT id FROM kosztorys_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))));

-- Policies for dictionaries
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

-- Policies for estimates
CREATE POLICY "kosztorys_estimates_all" ON kosztorys_estimates FOR ALL
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY "kosztorys_estimate_items_all" ON kosztorys_estimate_items FOR ALL
    USING (estimate_id IN (SELECT id FROM kosztorys_estimates WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY "kosztorys_estimate_equipment_all" ON kosztorys_estimate_equipment FOR ALL
    USING (estimate_id IN (SELECT id FROM kosztorys_estimates WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

-- Policies for proposals
CREATE POLICY "kosztorys_proposals_all" ON kosztorys_proposals FOR ALL
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Policies for request_files
CREATE POLICY "kosztorys_request_files_all" ON kosztorys_request_files FOR ALL
    USING (request_id IN (SELECT id FROM kosztorys_requests WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));
