import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, UserPlus, Shield, KeyRound } from "lucide-react";

const AdminCollaboratorManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState({
    can_approve_profiles: false,
    can_manage_seals: false,
    can_manage_invites: false,
  });

  // Fetch collaborators (users with colaborador role + their permissions)
  const { data: collaborators, isLoading } = useQuery({
    queryKey: ["admin-collaborators"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "colaborador");
      if (error) throw error;
      if (!roles?.length) return [];

      const userIds = roles.map((r) => r.user_id);

      const { data: perms } = await supabase
        .from("collaborator_permissions")
        .select("*")
        .in("user_id", userIds);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds);

      return userIds.map((uid) => ({
        user_id: uid,
        profile: profiles?.find((p) => p.user_id === uid),
        permissions: perms?.find((p) => p.user_id === uid),
      }));
    },
  });

  const createCollaborator = useMutation({
    mutationFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Não autenticado.");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-collaborator`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password, name, permissions }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar colaborador.");
      return data;
    },
    onSuccess: () => {
      toast.success("Colaborador criado com sucesso!");
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["admin-collaborators"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar colaborador."),
  });

  const updatePermissions = useMutation({
    mutationFn: async ({
      userId,
      perms,
    }: {
      userId: string;
      perms: Partial<typeof permissions>;
    }) => {
      // Check if permissions record exists
      const { data: existing } = await supabase
        .from("collaborator_permissions")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("collaborator_permissions")
          .update(perms)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("collaborator_permissions")
          .insert({ user_id: userId, ...perms });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Permissões atualizadas!");
      queryClient.invalidateQueries({ queryKey: ["admin-collaborators"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar."),
  });

  const removeCollaborator = useMutation({
    mutationFn: async (userId: string) => {
      // Remove role
      const { error: roleErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "colaborador");
      if (roleErr) throw roleErr;

      // Remove permissions
      await supabase
        .from("collaborator_permissions")
        .delete()
        .eq("user_id", userId);
    },
    onSuccess: () => {
      toast.success("Colaborador removido!");
      queryClient.invalidateQueries({ queryKey: ["admin-collaborators"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao remover."),
  });

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setPermissions({
      can_approve_profiles: false,
      can_manage_seals: false,
      can_manage_invites: false,
    });
  };

  const permissionLabels = [
    { key: "can_approve_profiles", label: "Aprovar/rejeitar perfis" },
    { key: "can_manage_seals", label: "Gerenciar selos" },
    { key: "can_manage_invites", label: "Gerenciar convites" },
  ] as const;

  return (
    <div className="bg-card rounded-2xl shadow-card p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Colaboradores</h2>
          <p className="text-sm text-muted-foreground">Crie e gerencie acessos de colaboradores.</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}>
          <UserPlus className="h-4 w-4 mr-1" />
          Novo colaborador
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !collaborators?.length ? (
        <p className="text-sm text-muted-foreground">Nenhum colaborador cadastrado.</p>
      ) : (
        <div className="space-y-4">
          {collaborators.map((collab) => (
            <div
              key={collab.user_id}
              className="border border-border rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {collab.profile?.email || collab.user_id.slice(0, 8)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("Remover este colaborador?"))
                      removeCollaborator.mutate(collab.user_id);
                  }}
                  disabled={removeCollaborator.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-4">
                {permissionLabels.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={collab.permissions?.[key] ?? false}
                      onCheckedChange={(checked) =>
                        updatePermissions.mutate({
                          userId: collab.user_id,
                          perms: { [key]: !!checked },
                        })
                      }
                      disabled={updatePermissions.isPending}
                    />
                    <span className="text-sm text-foreground">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Colaborador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do colaborador"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Senha</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Permissões</label>
              <div className="space-y-2">
                {permissionLabels.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={permissions[key]}
                      onCheckedChange={(checked) =>
                        setPermissions((prev) => ({ ...prev, [key]: !!checked }))
                      }
                    />
                    <span className="text-sm text-foreground">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button
              onClick={() => createCollaborator.mutate()}
              disabled={createCollaborator.isPending || !name.trim() || !email.trim() || password.length < 6}
              className="w-full"
            >
              {createCollaborator.isPending ? "Criando..." : "Criar colaborador"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCollaboratorManager;
