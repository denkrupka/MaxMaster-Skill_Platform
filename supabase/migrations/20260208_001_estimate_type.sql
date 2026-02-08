-- =====================================================
-- ДОБАВЛЕНИЕ ТИПА КОШТOРИСА (INWESTORSKI/WYKONAWCZY)
-- =====================================================

-- Добавляем поле estimate_type к таблице kosztorys_estimates
ALTER TABLE kosztorys_estimates
ADD COLUMN IF NOT EXISTS estimate_type VARCHAR(20) NOT NULL DEFAULT 'inwestorski'
CHECK (estimate_type IN ('inwestorski', 'wykonawczy'));

-- Добавляем комментарий для документации
COMMENT ON COLUMN kosztorys_estimates.estimate_type IS 'Тип коштoриса: inwestorski (инвесторский) или wykonawczy (исполнительский)';

-- Добавляем индекс для быстрого фильтра по типу
CREATE INDEX IF NOT EXISTS idx_kosztorys_estimates_type ON kosztorys_estimates(estimate_type);
