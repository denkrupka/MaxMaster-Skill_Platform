-- eKosztorysowanie Database Schema
-- PostgreSQL

-- Расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- СПРАВОЧНИКИ
-- =====================================================

-- Единицы измерения
CREATE TABLE units (
    id SERIAL PRIMARY KEY,
    index VARCHAR(10) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    lang VARCHAR(5) DEFAULT 'pl'
);

-- Каталоги нормативов
CREATE TABLE catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL,  -- KNNR, KNR, KSNR
    name VARCHAR(200) NOT NULL,
    description TEXT
);

-- Нормативы из каталогов
CREATE TABLE catalog_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    catalog_id UUID REFERENCES catalogs(id),
    code VARCHAR(50) NOT NULL,   -- "KNNR 5 0701-01"
    name TEXT NOT NULL,
    unit_id INTEGER REFERENCES units(id),
    
    -- Ресурсы по умолчанию (JSON)
    default_resources JSONB,
    
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(code)
);

-- =====================================================
-- ОРГАНИЗАЦИИ И ПОЛЬЗОВАТЕЛИ
-- =====================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    address TEXT,
    contacts JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(200),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- СМЕТЫ (ГЛАВНАЯ ТАБЛИЦА)
-- =====================================================

CREATE TABLE cost_estimates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    created_by UUID REFERENCES users(id),
    
    -- Основные данные
    type VARCHAR(20) NOT NULL CHECK (type IN ('investor', 'contractor', 'offer')),
    name VARCHAR(300) NOT NULL,
    description TEXT,
    currency VARCHAR(3) DEFAULT 'PLN',
    
    -- Настройки точности
    precision_norms INTEGER DEFAULT 6,
    precision_resources INTEGER DEFAULT 2,
    precision_measurements INTEGER DEFAULT 2,
    precision_unit_values INTEGER DEFAULT 2,
    precision_position_base INTEGER DEFAULT 2,
    precision_cost_estimate_base INTEGER DEFAULT 2,
    rounding_method VARCHAR(50) DEFAULT 'default',
    
    -- Шаблон расчёта
    calculation_template VARCHAR(50) DEFAULT 'overhead-on-top',
    
    -- Глобальные коэффициенты
    factor_labor DECIMAL(10,6) DEFAULT 1,
    factor_material DECIMAL(10,6) DEFAULT 1,
    factor_equipment DECIMAL(10,6) DEFAULT 1,
    factor_waste DECIMAL(10,6) DEFAULT 1,
    
    -- Титульная страница (JSON)
    title_page JSONB,
    
    -- Настройки печати (JSON)
    print_settings JSONB,
    
    -- Итоги (рассчитываются)
    total_labor DECIMAL(15,2) DEFAULT 0,
    total_material DECIMAL(15,2) DEFAULT 0,
    total_equipment DECIMAL(15,2) DEFAULT 0,
    total_overhead DECIMAL(15,2) DEFAULT 0,
    total_value DECIMAL(15,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    modified_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- РАЗДЕЛЫ СМЕТЫ
-- =====================================================

CREATE TABLE sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cost_estimate_id UUID REFERENCES cost_estimates(id) ON DELETE CASCADE,
    parent_section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
    
    ordinal_number INTEGER NOT NULL,
    name VARCHAR(300),
    description TEXT,
    
    -- Коэффициенты раздела
    factor_labor DECIMAL(10,6) DEFAULT 1,
    factor_material DECIMAL(10,6) DEFAULT 1,
    factor_equipment DECIMAL(10,6) DEFAULT 1,
    factor_waste DECIMAL(10,6) DEFAULT 1,
    
    -- Накладные раздела (JSON)
    overheads JSONB DEFAULT '[]',
    
    -- Итоги раздела
    total_labor DECIMAL(15,2) DEFAULT 0,
    total_material DECIMAL(15,2) DEFAULT 0,
    total_equipment DECIMAL(15,2) DEFAULT 0,
    total_value DECIMAL(15,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- ПОЗИЦИИ СМЕТЫ
-- =====================================================

CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cost_estimate_id UUID REFERENCES cost_estimates(id) ON DELETE CASCADE,
    section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
    
    ordinal_number INTEGER NOT NULL,
    
    -- Основа из каталога
    base VARCHAR(50),           -- "KNNR 5 0701-01"
    origin_base VARCHAR(50),
    catalog_item_id UUID REFERENCES catalog_items(id),
    
    name TEXT NOT NULL,
    marker VARCHAR(50),
    
    -- Единица измерения
    unit_label VARCHAR(20) NOT NULL,
    unit_index VARCHAR(10),
    
    -- Количество (обмеры)
    measurements JSONB DEFAULT '{"rootIds":[],"entries":{}}',
    quantity DECIMAL(15,6) DEFAULT 0,  -- Вычисленное количество
    
    -- Множитель
    multiplication_factor DECIMAL(10,6) DEFAULT 1,
    
    -- Коэффициенты позиции
    factor_labor DECIMAL(10,6) DEFAULT 1,
    factor_material DECIMAL(10,6) DEFAULT 1,
    factor_equipment DECIMAL(10,6) DEFAULT 1,
    factor_waste DECIMAL(10,6) DEFAULT 1,
    
    -- Накладные позиции (JSON)
    overheads JSONB DEFAULT '[]',
    
    -- Для упрощённых смет - цена за единицу
    unit_price DECIMAL(15,2) DEFAULT 0,
    unit_price_currency VARCHAR(3) DEFAULT 'PLN',
    
    -- Итоги позиции
    total_labor DECIMAL(15,2) DEFAULT 0,
    total_material DECIMAL(15,2) DEFAULT 0,
    total_equipment DECIMAL(15,2) DEFAULT 0,
    total_value DECIMAL(15,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- РЕСУРСЫ (Робочизна, Материалы, Оборудование)
-- =====================================================

CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
    
    type VARCHAR(20) NOT NULL CHECK (type IN ('labor', 'material', 'equipment')),
    
    name VARCHAR(300) NOT NULL,
    index VARCHAR(50),
    origin_index_type VARCHAR(20),  -- 'ETO', 'KNNR', 'custom'
    origin_index VARCHAR(50),
    
    -- Норма расхода
    norm_type VARCHAR(20) DEFAULT 'absolute',  -- 'absolute', 'relative'
    norm_value DECIMAL(15,6) NOT NULL,
    
    -- Коэффициент ресурса
    factor DECIMAL(10,6) DEFAULT 1,
    
    -- Единица измерения
    unit_label VARCHAR(20) NOT NULL,
    unit_index VARCHAR(10),
    
    -- Цена за единицу
    unit_price DECIMAL(15,2) DEFAULT 0,
    unit_price_currency VARCHAR(3) DEFAULT 'PLN',
    
    -- Группировка
    group_name VARCHAR(100),
    marker VARCHAR(50),
    
    -- Для инвесторских смет
    investor_total BOOLEAN DEFAULT FALSE,
    
    -- Вычисляемые поля
    calculated_quantity DECIMAL(15,6) DEFAULT 0,
    calculated_value DECIMAL(15,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- НАКЛАДНЫЕ РАСХОДЫ (шаблоны)
-- =====================================================

CREATE TABLE overhead_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    
    name VARCHAR(100) NOT NULL,  -- "Koszty pośrednie", "Zysk"
    type VARCHAR(20) NOT NULL,   -- 'percentage', 'fixed'
    value DECIMAL(10,4) NOT NULL,
    
    -- На что начисляется
    applies_to_labor BOOLEAN DEFAULT FALSE,
    applies_to_material BOOLEAN DEFAULT FALSE,
    applies_to_equipment BOOLEAN DEFAULT FALSE,
    
    is_default BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- КОММЕНТАРИИ / ОБСУЖДЕНИЯ
-- =====================================================

CREATE TABLE threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cost_estimate_id UUID REFERENCES cost_estimates(id) ON DELETE CASCADE,
    anchor_id UUID,  -- ID позиции или раздела
    
    task_category VARCHAR(50) DEFAULT 'none',
    task_status VARCHAR(20) DEFAULT 'todo',
    content TEXT NOT NULL,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- ИНДЕКСЫ
-- =====================================================

CREATE INDEX idx_cost_estimates_org ON cost_estimates(organization_id);
CREATE INDEX idx_sections_estimate ON sections(cost_estimate_id);
CREATE INDEX idx_sections_parent ON sections(parent_section_id);
CREATE INDEX idx_positions_estimate ON positions(cost_estimate_id);
CREATE INDEX idx_positions_section ON positions(section_id);
CREATE INDEX idx_resources_position ON resources(position_id);
CREATE INDEX idx_resources_type ON resources(type);
CREATE INDEX idx_catalog_items_code ON catalog_items(code);

-- =====================================================
-- ТРИГГЕРЫ ДЛЯ ОБНОВЛЕНИЯ ИТОГОВ
-- =====================================================

-- Функция пересчёта позиции
CREATE OR REPLACE FUNCTION recalculate_position()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE positions p SET
        total_labor = COALESCE((
            SELECT SUM(calculated_value) FROM resources 
            WHERE position_id = p.id AND type = 'labor'
        ), 0) * p.factor_labor,
        
        total_material = COALESCE((
            SELECT SUM(calculated_value) FROM resources 
            WHERE position_id = p.id AND type = 'material'
        ), 0) * p.factor_material * (1 + p.factor_waste / 100),
        
        total_equipment = COALESCE((
            SELECT SUM(calculated_value) FROM resources 
            WHERE position_id = p.id AND type = 'equipment'
        ), 0) * p.factor_equipment
    WHERE p.id = NEW.position_id;
    
    -- Обновляем total_value
    UPDATE positions SET
        total_value = total_labor + total_material + total_equipment
    WHERE id = NEW.position_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalc_position
AFTER INSERT OR UPDATE ON resources
FOR EACH ROW EXECUTE FUNCTION recalculate_position();

-- =====================================================
-- ВСТАВКА НАЧАЛЬНЫХ ДАННЫХ
-- =====================================================

-- Единицы измерения
INSERT INTO units (index, unit, name, lang) VALUES
('020', 'szt.', 'sztuka', 'pl'),
('023', 'tys.szt.', 'tysiąc sztuk', 'pl'),
('033', 'kg', 'kilogram', 'pl'),
('034', 't', 'tona', 'pl'),
('040', 'm', 'metr', 'pl'),
('050', 'm2', 'metr kwadratowy', 'pl'),
('060', 'm3', 'metr sześcienny', 'pl'),
('070', 'kW', 'kilowat', 'pl'),
('090', 'kpl', 'komplet', 'pl'),
('149', 'r-g', 'roboczogodzina', 'pl'),
('150', 'm-g', 'maszynogodzina', 'pl');

-- Каталоги
INSERT INTO catalogs (code, name) VALUES
('KNNR', 'Katalog Nakładów Nakładowych Roboczych'),
('KNNR-W', 'KNNR - Wersja Rozszerzona'),
('KNR', 'Katalog Nakładów Rzeczowych'),
('KSNR', 'Katalog Scalonych Nakładów Rzeczowych');
