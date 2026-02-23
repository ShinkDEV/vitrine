import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Eye, Pause, Play, Clock } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800" },
  publicado: { label: "Publicado", color: "bg-green-100 text-green-800" },
  pausado: { label: "Pausado", color: "bg-orange-100 text-orange-800" },
};

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("pendente");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Check if user is admin
  const { data: hasAccess, isLoading: roleLoading } = useQuery({
    queryKey: ["is-admin-or-colaborador", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .in("role", ["admin", "colaborador"]);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
    if (!authLoading && !roleLoading && user && hasAccess === false) {
      toast.error("Acesso negado.");
      navigate("/dashboard");
    }
  }, [user, authLoading, hasAccess, roleLoading, navigate]);
  }, [user, authLoading, isAdmin, roleLoading, navigate]);

  // Fetch professionals
  const { data: professionals, isLoading } = useQuery({
    queryKey: ["admin-professionals", filter],
    queryFn: async () => {
      let query = supabase
        .from("professionals")
        .select("*, services(*), portfolio_photos(*)")
        .order("updated_at", { ascending: false });

      if (filter !== "todos") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("professionals")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado!");
      queryClient.invalidateQueries({ queryKey: ["admin-professionals"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar."),
  });

  if (authLoading || roleLoading || !isAdmin) return null;

  const filters = [
    { value: "pendente", label: "Pendentes" },
    { value: "publicado", label: "Publicados" },
    { value: "pausado", label: "Pausados" },
    { value: "rascunho", label: "Rascunhos" },
    { value: "todos", label: "Todos" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-card rounded-2xl shadow-card p-8 animate-fade-in">
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">
            Painel Administrativo
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Gerencie os perfis dos profissionais.
          </p>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {filters.map((f) => (
              <Button
                key={f.value}
                variant={filter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {/* List */}
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : !professionals?.length ? (
            <p className="text-muted-foreground text-sm">Nenhum profissional encontrado.</p>
          ) : (
            <div className="space-y-4">
              {professionals.map((pro) => {
                const statusInfo = STATUS_LABELS[pro.status] || STATUS_LABELS.rascunho;
                return (
                  <div
                    key={pro.id}
                    className="border border-border rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center"
                  >
                    {/* Avatar + Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
                        {pro.profile_photo_url ? (
                          <img src={pro.profile_photo_url} alt={pro.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground font-display text-lg">
                            {pro.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{pro.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {pro.city && pro.state ? `${pro.city}, ${pro.state}` : "Localização não definida"}
                          {" · "}
                          {pro.services?.length ?? 0} serviço(s)
                          {" · "}
                          {pro.portfolio_photos?.length ?? 0} foto(s)
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      {pro.status === "pendente" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => updateStatus.mutate({ id: pro.id, status: "publicado" })}
                            disabled={updateStatus.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => updateStatus.mutate({ id: pro.id, status: "rascunho" })}
                            disabled={updateStatus.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeitar
                          </Button>
                        </>
                      )}
                      {pro.status === "publicado" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus.mutate({ id: pro.id, status: "pausado" })}
                          disabled={updateStatus.isPending}
                        >
                          <Pause className="h-4 w-4 mr-1" />
                          Pausar
                        </Button>
                      )}
                      {pro.status === "pausado" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus.mutate({ id: pro.id, status: "publicado" })}
                          disabled={updateStatus.isPending}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Reativar
                        </Button>
                      )}
                      {pro.status === "rascunho" && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Aguardando envio
                        </span>
                      )}
                      {pro.slug && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`/p/${pro.slug}`, "_blank")}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
