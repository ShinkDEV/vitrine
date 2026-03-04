
CREATE TABLE public.pending_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(professional_id)
);

ALTER TABLE public.pending_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own pending changes"
ON public.pending_changes FOR SELECT
USING (EXISTS (
  SELECT 1 FROM professionals WHERE professionals.id = pending_changes.professional_id AND professionals.user_id = auth.uid()
));

CREATE POLICY "Owners can insert pending changes"
ON public.pending_changes FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM professionals WHERE professionals.id = pending_changes.professional_id AND professionals.user_id = auth.uid()
));

CREATE POLICY "Owners can update pending changes"
ON public.pending_changes FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM professionals WHERE professionals.id = pending_changes.professional_id AND professionals.user_id = auth.uid()
));

CREATE POLICY "Owners can delete pending changes"
ON public.pending_changes FOR DELETE
USING (EXISTS (
  SELECT 1 FROM professionals WHERE professionals.id = pending_changes.professional_id AND professionals.user_id = auth.uid()
));

CREATE POLICY "Admins can view all pending changes"
ON public.pending_changes FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pending changes"
ON public.pending_changes FOR DELETE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Colaboradores can view all pending changes"
ON public.pending_changes FOR SELECT
USING (has_role(auth.uid(), 'colaborador'));

CREATE POLICY "Colaboradores can delete pending changes"
ON public.pending_changes FOR DELETE
USING (has_role(auth.uid(), 'colaborador'));

CREATE TRIGGER update_pending_changes_updated_at
  BEFORE UPDATE ON public.pending_changes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
