
-- Create working hours table
CREATE TABLE public.working_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(professional_id, day_of_week)
);

ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;

-- Anyone can view working hours of published pros
CREATE POLICY "Anyone can view working hours"
ON public.working_hours FOR SELECT
USING (EXISTS (
  SELECT 1 FROM professionals
  WHERE professionals.id = working_hours.professional_id
    AND (professionals.status = 'publicado' OR professionals.user_id = auth.uid())
));

-- Owners can manage their working hours
CREATE POLICY "Owners can insert working hours"
ON public.working_hours FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM professionals
  WHERE professionals.id = working_hours.professional_id
    AND professionals.user_id = auth.uid()
));

CREATE POLICY "Owners can update working hours"
ON public.working_hours FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM professionals
  WHERE professionals.id = working_hours.professional_id
    AND professionals.user_id = auth.uid()
));

CREATE POLICY "Owners can delete working hours"
ON public.working_hours FOR DELETE
USING (EXISTS (
  SELECT 1 FROM professionals
  WHERE professionals.id = working_hours.professional_id
    AND professionals.user_id = auth.uid()
));
