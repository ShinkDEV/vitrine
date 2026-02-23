
-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Create user roles table
CREATE TYPE public.app_role AS ENUM ('professional', 'admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Create professionals table
CREATE TABLE public.professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  bio TEXT,
  country TEXT DEFAULT 'Brasil',
  state TEXT,
  city TEXT,
  address_street TEXT,
  address_number TEXT,
  address_neighborhood TEXT,
  address_complement TEXT,
  payment_methods TEXT[] DEFAULT '{}',
  whatsapp_number TEXT,
  whatsapp_link TEXT,
  profile_photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'pendente', 'publicado', 'pausado')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

-- Public can view published professionals
CREATE POLICY "Anyone can view published professionals" ON public.professionals FOR SELECT USING (status = 'publicado');
-- Owners can view their own regardless of status
CREATE POLICY "Owners can view own professional" ON public.professionals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owners can insert own professional" ON public.professionals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update own professional" ON public.professionals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all" ON public.professionals FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all" ON public.professionals FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Services table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  price NUMERIC,
  duration_minutes INTEGER,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view services of published pros" ON public.services FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.professionals WHERE id = professional_id AND (status = 'publicado' OR user_id = auth.uid()))
);
CREATE POLICY "Owners can insert services" ON public.services FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.professionals WHERE id = professional_id AND user_id = auth.uid())
);
CREATE POLICY "Owners can update services" ON public.services FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.professionals WHERE id = professional_id AND user_id = auth.uid())
);
CREATE POLICY "Owners can delete services" ON public.services FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.professionals WHERE id = professional_id AND user_id = auth.uid())
);

-- Portfolio photos table
CREATE TABLE public.portfolio_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE NOT NULL,
  photo_url TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view photos of published pros" ON public.portfolio_photos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.professionals WHERE id = professional_id AND (status = 'publicado' OR user_id = auth.uid()))
);
CREATE POLICY "Owners can insert photos" ON public.portfolio_photos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.professionals WHERE id = professional_id AND user_id = auth.uid())
);
CREATE POLICY "Owners can delete photos" ON public.portfolio_photos FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.professionals WHERE id = professional_id AND user_id = auth.uid())
);

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updating updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_professionals_updated_at
  BEFORE UPDATE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('professional-photos', 'professional-photos', true);

CREATE POLICY "Anyone can view professional photos" ON storage.objects FOR SELECT USING (bucket_id = 'professional-photos');
CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'professional-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own photos" ON storage.objects FOR UPDATE USING (bucket_id = 'professional-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete own photos" ON storage.objects FOR DELETE USING (bucket_id = 'professional-photos' AND auth.role() = 'authenticated');

-- Create slug generation function
CREATE OR REPLACE FUNCTION public.generate_slug(name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
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
