
-- Collaborator permissions table
CREATE TABLE public.collaborator_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  can_approve_profiles boolean NOT NULL DEFAULT false,
  can_manage_seals boolean NOT NULL DEFAULT false,
  can_manage_invites boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.collaborator_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage collaborator permissions
CREATE POLICY "Admins can manage collaborator permissions" ON public.collaborator_permissions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Collaborators can view their own permissions
CREATE POLICY "Collaborators can view own permissions" ON public.collaborator_permissions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
