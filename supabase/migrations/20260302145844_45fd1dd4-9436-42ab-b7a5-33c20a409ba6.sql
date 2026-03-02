
-- Add use_count and max_uses columns, drop single-use constraint
ALTER TABLE public.invites ADD COLUMN use_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.invites ADD COLUMN max_uses integer;

-- Drop the old policy that required used_by IS NULL for validation
DROP POLICY IF EXISTS "Anyone can validate invite codes" ON public.invites;
DROP POLICY IF EXISTS "Users can mark invite as used" ON public.invites;

-- New validation policy: not expired and (no max_uses or use_count < max_uses)
CREATE POLICY "Anyone can validate invite codes" ON public.invites
  FOR SELECT TO anon, authenticated
  USING (expires_at > now() AND (max_uses IS NULL OR use_count < max_uses));

-- Allow authenticated users to increment use_count
CREATE POLICY "Users can increment invite use_count" ON public.invites
  FOR UPDATE TO authenticated
  USING (expires_at > now() AND (max_uses IS NULL OR use_count < max_uses))
  WITH CHECK (true);
