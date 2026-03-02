
DROP POLICY IF EXISTS "Users can increment invite use_count" ON public.invites;

CREATE POLICY "Users can increment invite use_count" ON public.invites
  FOR UPDATE TO authenticated
  USING (expires_at > now() AND (max_uses IS NULL OR use_count < max_uses))
  WITH CHECK (use_count >= 0);
