
-- Create certificates table
CREATE TABLE public.professional_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.professional_certificates ENABLE ROW LEVEL SECURITY;

-- Owners can view their own certificates
CREATE POLICY "Owners can view own certificates"
ON public.professional_certificates
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM professionals WHERE professionals.id = professional_certificates.professional_id AND professionals.user_id = auth.uid()
));

-- Owners can insert certificates
CREATE POLICY "Owners can insert certificates"
ON public.professional_certificates
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM professionals WHERE professionals.id = professional_certificates.professional_id AND professionals.user_id = auth.uid()
));

-- Owners can delete certificates
CREATE POLICY "Owners can delete certificates"
ON public.professional_certificates
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM professionals WHERE professionals.id = professional_certificates.professional_id AND professionals.user_id = auth.uid()
));

-- Admins can view all certificates
CREATE POLICY "Admins can view all certificates"
ON public.professional_certificates
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Colaboradores can view all certificates
CREATE POLICY "Colaboradores can view all certificates"
ON public.professional_certificates
FOR SELECT
USING (has_role(auth.uid(), 'colaborador'::app_role));

-- Create storage bucket for certificates
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', false);

-- Storage policies: owners can upload to their folder
CREATE POLICY "Owners can upload certificates"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'certificates' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Owners can view their own certificate files
CREATE POLICY "Owners can view own certificate files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'certificates' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Owners can delete their own certificate files
CREATE POLICY "Owners can delete own certificate files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'certificates' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins can view all certificate files
CREATE POLICY "Admins can view all certificate files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'certificates' AND has_role(auth.uid(), 'admin'::app_role));

-- Colaboradores can view all certificate files
CREATE POLICY "Colaboradores can view all certificate files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'certificates' AND has_role(auth.uid(), 'colaborador'::app_role));
