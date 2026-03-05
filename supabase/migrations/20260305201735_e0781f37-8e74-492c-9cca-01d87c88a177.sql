
-- Allow admins to view all portfolio photos
CREATE POLICY "Admins can view all portfolio photos"
ON public.portfolio_photos FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow collaborators to view all portfolio photos
CREATE POLICY "Colaboradores can view all portfolio photos"
ON public.portfolio_photos FOR SELECT
USING (has_role(auth.uid(), 'colaborador'::app_role));

-- Allow admins to view all services
CREATE POLICY "Admins can view all services"
ON public.services FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow collaborators to view all services
CREATE POLICY "Colaboradores can view all services"
ON public.services FOR SELECT
USING (has_role(auth.uid(), 'colaborador'::app_role));

-- Allow admins to view all working hours
CREATE POLICY "Admins can view all working hours"
ON public.working_hours FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow collaborators to view all working hours
CREATE POLICY "Colaboradores can view all working hours"
ON public.working_hours FOR SELECT
USING (has_role(auth.uid(), 'colaborador'::app_role));
