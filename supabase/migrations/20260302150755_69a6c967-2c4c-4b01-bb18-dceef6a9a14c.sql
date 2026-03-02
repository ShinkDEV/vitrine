
-- Allow expires_at to be null (meaning lifetime/never expires)
ALTER TABLE public.invites ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE public.invites ALTER COLUMN expires_at SET DEFAULT NULL;

-- Update validation policies to handle null expires_at
DROP POLICY IF EXISTS "Anyone can validate invite codes" ON public.invites;
CREATE POLICY "Anyone can validate invite codes" ON public.invites
  FOR SELECT TO anon, authenticated
  USING ((expires_at IS NULL OR expires_at > now()) AND (max_uses IS NULL OR use_count < max_uses));

DROP POLICY IF EXISTS "Users can increment invite use_count" ON public.invites;
CREATE POLICY "Users can increment invite use_count" ON public.invites
  FOR UPDATE TO authenticated
  USING ((expires_at IS NULL OR expires_at > now()) AND (max_uses IS NULL OR use_count < max_uses))
  WITH CHECK (use_count >= 0);
