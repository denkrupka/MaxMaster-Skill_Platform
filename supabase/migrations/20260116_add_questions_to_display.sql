-- Migration: Add questions_to_display column to tests table
-- Date: 2026-01-16
-- Description: Adds optional field to limit number of questions displayed from test pool

-- Add the new column
ALTER TABLE tests
ADD COLUMN IF NOT EXISTS questions_to_display INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN tests.questions_to_display IS 'Optional: Number of questions to display from total pool. If NULL, all questions are shown. Questions are always randomized.';
