
-- Create invites table
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_by uuid NOT NULL,
  email text,
  used_by uuid,
  used_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage invites" ON public.invites
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Colaboradores can manage invites
CREATE POLICY "Colaboradores can manage invites" ON public.invites
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'colaborador'::app_role))
  WITH CHECK (has_role(auth.uid(), 'colaborador'::app_role));

-- Anyone can validate an invite code (select only unused, non-expired)
CREATE POLICY "Anyone can validate invite codes" ON public.invites
  FOR SELECT TO anon, authenticated
  USING (used_by IS NULL AND expires_at > now());
