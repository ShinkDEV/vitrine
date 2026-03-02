import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Link2, Mail } from "lucide-react";

const AdminInviteManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");

  const { data: invites, isLoading } = useQuery({
    queryKey: ["admin-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createInvite = useMutation({
    mutationFn: async (inviteEmail?: string) => {
      const { data, error } = await supabase
        .from("invites")
        .insert({
          created_by: user!.id,
          email: inviteEmail || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const link = `${window.location.origin}/cadastro?invite=${data.code}`;
      navigator.clipboard.writeText(link);
      toast.success("Convite criado e link copiado!");
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      setEmail("");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar convite."),
  });

  const deleteInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convite removido.");
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao remover."),
  });

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/cadastro?invite=${code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const getStatus = (invite: any) => {
    if (invite.used_by) return { label: "Usado", color: "bg-green-100 text-green-800" };
    if (new Date(invite.expires_at) < new Date()) return { label: "Expirado", color: "bg-red-100 text-red-800" };
    return { label: "Pendente", color: "bg-yellow-100 text-yellow-800" };
  };

  return (
    <div className="bg-card rounded-2xl shadow-card p-8 animate-fade-in">
      <h2 className="text-xl font-display font-bold text-foreground mb-1">
        Convites
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Gere links de convite para novos profissionais se cadastrarem.
      </p>

      {/* Create invite */}
      <div className="flex gap-2 mb-6">
        <Input
          placeholder="Email do profissional (opcional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
        />
        <Button
          onClick={() => createInvite.mutate(email.trim() || undefined)}
          disabled={createInvite.isPending}
        >
          <Plus className="h-4 w-4 mr-1" />
          Gerar convite
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !invites?.length ? (
        <p className="text-sm text-muted-foreground">Nenhum convite criado.</p>
      ) : (
        <div className="space-y-3">
          {invites.map((invite) => {
            const status = getStatus(invite);
            return (
              <div
                key={invite.id}
                className="border border-border rounded-xl p-3 flex flex-col sm:flex-row gap-2 sm:items-center"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <code className="text-xs text-foreground font-mono truncate">{invite.code}</code>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {invite.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {invite.email}
                      </span>
                    )}
                    <span>
                      Criado em {new Date(invite.created_at).toLocaleDateString("pt-BR")}
                    </span>
                    <span>
                      Expira em {new Date(invite.expires_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {!invite.used_by && new Date(invite.expires_at) > new Date() && (
                    <Button size="sm" variant="outline" onClick={() => copyLink(invite.code)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {!invite.used_by && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteInvite.mutate(invite.id)}
                      disabled={deleteInvite.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminInviteManager;
