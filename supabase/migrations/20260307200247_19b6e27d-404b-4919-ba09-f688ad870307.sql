-- Remove default so new rows don't auto-get a number
ALTER TABLE public.professionals ALTER COLUMN member_number DROP DEFAULT;

-- Clear member_number for non-published profiles
UPDATE public.professionals SET member_number = NULL WHERE status != 'publicado';

-- Create trigger to assign member_number only when approved
CREATE OR REPLACE FUNCTION public.assign_member_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only assign when status changes TO 'publicado' and no number yet
  IF NEW.status = 'publicado' AND NEW.member_number IS NULL 
     AND (OLD.status IS DISTINCT FROM 'publicado') THEN
    NEW.member_number := nextval('public.professionals_member_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_member_number
  BEFORE UPDATE ON public.professionals
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_member_number();