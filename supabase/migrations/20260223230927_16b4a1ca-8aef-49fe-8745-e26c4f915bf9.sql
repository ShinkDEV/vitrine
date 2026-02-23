
-- Add image_url column to seals
ALTER TABLE public.seals ADD COLUMN image_url TEXT;

-- Remove all existing seals and their assignments
DELETE FROM public.professional_seals;
DELETE FROM public.seals;

-- Insert the 3 correct seals with image URLs
INSERT INTO public.seals (name, icon, image_url) VALUES
  ('Especialista', '🎓', '/seals/especialista.png'),
  ('Especialista GOLD', '⭐', '/seals/especialista-gold.png'),
  ('Especialista ELITE', '💎', '/seals/especialista-elite.png');
