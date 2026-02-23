
-- Add rejection_reason column to professionals
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Allow colaboradors to view all professionals
CREATE POLICY "Colaboradors can view all"
ON public.professionals
FOR SELECT
USING (has_role(auth.uid(), 'colaborador'::app_role));

-- Allow colaboradors to update professional status
CREATE POLICY "Colaboradors can update status"
ON public.professionals
FOR UPDATE
USING (has_role(auth.uid(), 'colaborador'::app_role));
