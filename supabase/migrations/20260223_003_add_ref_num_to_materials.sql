-- Add manufacturer reference number (indeks producenta) to kosztorys_materials
ALTER TABLE public.kosztorys_materials
  ADD COLUMN IF NOT EXISTS ref_num VARCHAR(100) NULL;
