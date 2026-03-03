
-- Update trigger to NOT create professional profiles when user is created via admin (collaborators)
-- The trigger still runs but the edge function cleans up. Let's add a DB-level guard.

-- Create a function that prevents collaborators from setting status to 'pendente'
CREATE OR REPLACE FUNCTION public.prevent_collaborator_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If status is being changed to 'pendente', check if user is collaborator-only
  IF NEW.status = 'pendente' AND (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = NEW.user_id AND role = 'colaborador'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = NEW.user_id AND role = 'professional'
    )
  ) THEN
    RAISE EXCEPTION 'Colaboradores não podem enviar perfis para aprovação.';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on professionals table
CREATE TRIGGER check_collaborator_submission
BEFORE UPDATE ON public.professionals
FOR EACH ROW
WHEN (NEW.status = 'pendente')
EXECUTE FUNCTION public.prevent_collaborator_submission();
