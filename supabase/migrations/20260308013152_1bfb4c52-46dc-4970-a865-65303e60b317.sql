
CREATE TABLE public.banner_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_id uuid NOT NULL REFERENCES public.banners(id) ON DELETE CASCADE,
  clicked_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.banner_clicks ENABLE ROW LEVEL SECURITY;

-- Anyone can insert clicks (anonymous tracking)
CREATE POLICY "Anyone can insert banner clicks"
ON public.banner_clicks
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Admins can view clicks
CREATE POLICY "Admins can view banner clicks"
ON public.banner_clicks
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
