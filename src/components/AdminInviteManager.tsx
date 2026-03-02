import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

const CUSTOM_DOMAIN = "https://vitrine.escola.ro";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Link2, Users } from "lucide-react";

const AdminInviteManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [customCode, setCustomCode] = useState("");
  const [lifetime, setLifetime] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );

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
    mutationFn: async (code?: string) => {
      const insertData: any = { created_by: user!.id };
      if (code) insertData.code = code;
      if (!lifetime && expiresAt) {
        insertData.expires_at = expiresAt.toISOString();
      } else {
        insertData.expires_at = null;
      }
      const { data, error } = await supabase
        .from("invites")
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const link = `${CUSTOM_DOMAIN}/cadastro?invite=${data.code}`;
      navigator.clipboard.writeText(link);
      toast.success("Convite criado e link copiado!");
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      setCustomCode("");
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
    const link = `${CUSTOM_DOMAIN}/cadastro?invite=${code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const getStatus = (invite: any) => {
    const expired = invite.expires_at && new Date(invite.expires_at) < new Date();
    const maxReached = invite.max_uses && invite.use_count >= invite.max_uses;
    if (expired) return { label: "Expirado", color: "bg-red-100 text-red-800" };
    if (maxReached) return { label: "Esgotado", color: "bg-muted text-muted-foreground" };
    return { label: "Ativo", color: "bg-green-100 text-green-800" };
  };

  return (
    <div className="bg-card rounded-2xl shadow-card p-8 animate-fade-in">
      <h2 className="text-xl font-display font-bold text-foreground mb-1">
        Convites
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Gere links de convite reutilizáveis para novos profissionais se cadastrarem.
      </p>

      {/* Create form */}
      <div className="space-y-3 mb-6 p-4 border border-border rounded-xl">
        <div className="flex gap-2">
          <Input
            placeholder="Código personalizado (opcional)"
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value.replace(/\s/g, "-").toLowerCase())}
            className="flex-1"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={lifetime} onCheckedChange={setLifetime} />
            <span className="text-sm text-foreground font-medium">Vitalício (sem expiração)</span>
          </label>

          {!lifetime && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "justify-start text-left font-normal",
                    !expiresAt && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {expiresAt ? format(expiresAt, "dd/MM/yyyy") : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiresAt}
                  onSelect={setExpiresAt}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>

        <Button
          onClick={() => createInvite.mutate(customCode.trim() || undefined)}
          disabled={createInvite.isPending || (!lifetime && !expiresAt)}
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
            const isActive = status.label === "Ativo";
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
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {invite.use_count} uso(s){invite.max_uses ? ` / ${invite.max_uses}` : ""}
                    </span>
                    <span>
                      Criado em {new Date(invite.created_at).toLocaleDateString("pt-BR")}
                    </span>
                    <span>
                      {invite.expires_at
                        ? `Expira em ${new Date(invite.expires_at).toLocaleDateString("pt-BR")}`
                        : "♾️ Vitalício"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {isActive && (
                    <Button size="sm" variant="outline" onClick={() => copyLink(invite.code)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteInvite.mutate(invite.id)}
                    disabled={deleteInvite.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
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
