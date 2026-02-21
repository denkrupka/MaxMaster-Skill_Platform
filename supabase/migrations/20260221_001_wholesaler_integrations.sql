-- Wholesaler integrations table
CREATE TABLE IF NOT EXISTS public.wholesaler_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  wholesaler_id TEXT NOT NULL,        -- e.g. 'tim'
  wholesaler_name TEXT NOT NULL,      -- e.g. 'TIM S.A.'
  branza TEXT NOT NULL,               -- e.g. 'elektryczne'
  credentials JSONB DEFAULT '{}'::jsonb,  -- { username, password, cookies, gql_works, last_refresh }
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, wholesaler_id)
);

-- RLS
ALTER TABLE public.wholesaler_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view their integrations"
  ON public.wholesaler_integrations FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Company admins can manage integrations"
  ON public.wholesaler_integrations FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_wholesaler_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_wholesaler_integrations_updated_at
  BEFORE UPDATE ON public.wholesaler_integrations
  FOR EACH ROW EXECUTE FUNCTION update_wholesaler_integrations_updated_at();
