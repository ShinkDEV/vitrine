
-- Create a trigger to automatically create a professional profile when a new user is created
CREATE OR REPLACE FUNCTION public.handle_new_professional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_name TEXT;
  user_slug TEXT;
BEGIN
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

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created_professional
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_professional();
