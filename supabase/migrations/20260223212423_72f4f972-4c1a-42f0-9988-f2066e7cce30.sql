
CREATE OR REPLACE FUNCTION public.generate_slug(name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  base_slug := lower(regexp_replace(
    regexp_replace(
      translate(name, 'àáâãäåèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÑÇ', 'aaaaaaeeeeiiiioooooouuuuyyncAAAAAAEEEEIIIIOOOOOUUUUYYNC'),
      '[^a-z0-9\s-]', '', 'gi'
    ),
    '\s+', '-', 'g'
  ));
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.professionals WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  RETURN final_slug;
END;
$$;
