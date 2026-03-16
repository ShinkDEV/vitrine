
CREATE TABLE public.rejection_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  reason text NOT NULL,
  rejected_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.rejection_history ENABLE ROW LEVEL SECURITY;

-- Admins and collaborators can view rejection history
CREATE POLICY "Admins can view rejection history"
ON public.rejection_history
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Colaboradores can view rejection history"
ON public.rejection_history
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'colaborador'::app_role));

-- Admins and collaborators can insert rejection history
CREATE POLICY "Admins can insert rejection history"
ON public.rejection_history
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Colaboradores can insert rejection history"
ON public.rejection_history
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'colaborador'::app_role));

-- Owners can view their own rejection history
CREATE POLICY "Owners can view own rejection history"
ON public.rejection_history
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM professionals
  WHERE professionals.id = rejection_history.professional_id
  AND professionals.user_id = auth.uid()
));
