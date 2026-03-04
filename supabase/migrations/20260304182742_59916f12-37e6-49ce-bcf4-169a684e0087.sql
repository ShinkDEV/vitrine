
CREATE TABLE public.professional_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  course_name text NOT NULL,
  course_year integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(professional_id, course_name, course_year)
);

ALTER TABLE public.professional_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own courses"
ON public.professional_courses FOR SELECT
USING (EXISTS (
  SELECT 1 FROM professionals WHERE professionals.id = professional_courses.professional_id AND professionals.user_id = auth.uid()
));

CREATE POLICY "Owners can insert courses"
ON public.professional_courses FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM professionals WHERE professionals.id = professional_courses.professional_id AND professionals.user_id = auth.uid()
));

CREATE POLICY "Owners can delete courses"
ON public.professional_courses FOR DELETE
USING (EXISTS (
  SELECT 1 FROM professionals WHERE professionals.id = professional_courses.professional_id AND professionals.user_id = auth.uid()
));

CREATE POLICY "Anyone can view courses of published pros"
ON public.professional_courses FOR SELECT
USING (EXISTS (
  SELECT 1 FROM professionals WHERE professionals.id = professional_courses.professional_id AND professionals.status = 'publicado'
));

CREATE POLICY "Admins can view all courses"
ON public.professional_courses FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Colaboradores can view all courses"
ON public.professional_courses FOR SELECT
USING (has_role(auth.uid(), 'colaborador'));
