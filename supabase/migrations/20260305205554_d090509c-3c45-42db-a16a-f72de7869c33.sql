
-- Add CPF field to professionals
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS cpf text;

-- Create blocked_users table
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  cpf text,
  reason text NOT NULL,
  blocked_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  professional_name text
);

-- Enable RLS
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Only admins can manage blocked users
CREATE POLICY "Admins can manage blocked users"
  ON public.blocked_users FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Anyone can check if they are blocked (for registration check)
CREATE POLICY "Anyone can check blocked status"
  ON public.blocked_users FOR SELECT
  USING (true);
