
-- Fix the trigger to NOT create professional profiles for users created via admin (collaborators)
-- The trick: collaborators are created with user_metadata containing a specific marker
CREATE OR REPLACE FUNCTION public.handle_new_professional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name TEXT;
  user_slug TEXT;
BEGIN
  -- Skip if the user is being created as a collaborator (edge function sets this metadata)
  IF NEW.raw_user_meta_data->>'is_collaborator' = 'true' THEN
    RETURN NEW;
  END IF;

  -- Get name from user metadata, fallback to email
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  
  -- Generate slug
  user_slug := generate_slug(user_name);
  
  -- Create professional profile
  INSERT INTO public.professionals (user_id, name, slug, status)
  VALUES (NEW.id, user_name, user_slug, 'rascunho');
  
  -- Assign professional role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'professional');
  
  RETURN NEW;
END;
$$;
