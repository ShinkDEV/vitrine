
-- Drop the restrictive SELECT policies and recreate as PERMISSIVE
-- so that ANY matching policy grants access (OR logic instead of AND)

DROP POLICY IF EXISTS "Admins can view all" ON public.professionals;
DROP POLICY IF EXISTS "Anyone can view published professionals" ON public.professionals;
DROP POLICY IF EXISTS "Colaboradors can view all" ON public.professionals;
DROP POLICY IF EXISTS "Owners can view own professional" ON public.professionals;

-- Recreate as PERMISSIVE (default) — any one matching = access granted
CREATE POLICY "Anyone can view published professionals"
ON public.professionals FOR SELECT
USING (status = 'publicado');

CREATE POLICY "Owners can view own professional"
ON public.professionals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all"
ON public.professionals FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Colaboradors can view all"
ON public.professionals FOR SELECT
USING (has_role(auth.uid(), 'colaborador'::app_role));
