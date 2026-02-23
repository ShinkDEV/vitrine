
-- Create seals table for predefined seals
CREATE TABLE public.seals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '⭐',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.seals ENABLE ROW LEVEL SECURITY;

-- Anyone can view seals
CREATE POLICY "Anyone can view seals"
ON public.seals FOR SELECT
USING (true);

-- Only admins can manage seals
CREATE POLICY "Admins can insert seals"
ON public.seals FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update seals"
ON public.seals FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete seals"
ON public.seals FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Junction table: professional_seals
CREATE TABLE public.professional_seals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  seal_id UUID NOT NULL REFERENCES public.seals(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID NOT NULL,
  UNIQUE(professional_id, seal_id)
);

ALTER TABLE public.professional_seals ENABLE ROW LEVEL SECURITY;

-- Anyone can view assigned seals (for public profiles)
CREATE POLICY "Anyone can view professional seals"
ON public.professional_seals FOR SELECT
USING (true);

-- Admins can manage professional seals
CREATE POLICY "Admins can insert professional seals"
ON public.professional_seals FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'colaborador'::app_role));

CREATE POLICY "Admins can delete professional seals"
ON public.professional_seals FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'colaborador'::app_role));

-- Insert default seals
INSERT INTO public.seals (name, icon) VALUES
  ('Especialista Certificado', '🎓'),
  ('Profissional Destaque', '⭐'),
  ('Atendimento Exemplar', '💎'),
  ('Top Avaliações', '🏆'),
  ('Profissional Verificado', '✅');
