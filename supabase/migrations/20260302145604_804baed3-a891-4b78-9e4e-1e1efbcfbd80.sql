
-- Allow authenticated users to update an invite to mark it as used (only if not already used)
CREATE POLICY "Users can mark invite as used" ON public.invites
  FOR UPDATE TO authenticated
  USING (used_by IS NULL AND expires_at > now())
  WITH CHECK (used_by = auth.uid());
