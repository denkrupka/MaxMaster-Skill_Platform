-- Add parent_id to support hierarchical categories (subcategories)
ALTER TABLE public.kosztorys_custom_categories
  ADD COLUMN IF NOT EXISTS parent_id UUID NULL REFERENCES public.kosztorys_custom_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kosztorys_custom_categories_parent
  ON public.kosztorys_custom_categories(parent_id);
