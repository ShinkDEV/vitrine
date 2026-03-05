import { useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, Circle, Edit, ExternalLink, Send, AlertTriangle, Ban } from "lucide-react";
import BannerCarousel from "@/components/BannerCarousel";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Check if user is collaborator (not professional)
  const { data: userRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data?.map((r) => r.role) ?? [];
    },
    enabled: !!user,
  });

  const isCollaboratorOnly = userRoles && !userRoles.includes("professional") && userRoles.includes("colaborador") && !userRoles.includes("admin");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!rolesLoading && isCollaboratorOnly) navigate("/admin", { replace: true });
  }, [rolesLoading, isCollaboratorOnly, navigate]);

  const { data: professional } = useQuery({
    queryKey: ["my-professional", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("*, services(*), portfolio_photos(*)")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const submitForApproval = useMutation({
    mutationFn: async () => {
      if (!professional) return;
      const { error } = await supabase
        .from("professionals")
        .update({ status: "pendente" })
        .eq("id", professional.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pronto! Seu perfil foi preenchido e está aguardando aprovação! 🎉", { duration: 6000 });
      queryClient.invalidateQueries({ queryKey: ["my-professional"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao enviar para aprovação."),
  });
  // Portfolio update check (6 months)
  const portfolioUpdateStatus = useMemo(() => {
    if (!professional?.last_portfolio_update) return null;
    const lastUpdate = new Date(professional.last_portfolio_update);
    const now = new Date();
    const diffMs = now.getTime() - lastUpdate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const SIX_MONTHS_DAYS = 180;
    const WARNING_DAYS = 150; // 5 months - pre-warning
    if (diffDays >= SIX_MONTHS_DAYS) return "expired";
    if (diffDays >= WARNING_DAYS) return "warning";
    return null;
  }, [professional?.last_portfolio_update]);

  if (authLoading || !user || rolesLoading || isCollaboratorOnly) return null;

  const checks = [
    { label: "Foto de perfil", done: !!professional?.profile_photo_url },
    { label: "Cidade e Estado", done: !!professional?.city && !!professional?.state },
    { label: "Pelo menos 1 serviço", done: (professional?.services?.length ?? 0) >= 1 },
    { label: "WhatsApp configurado", done: !!professional?.whatsapp_number },
    { label: "Portfólio com no mínimo 3 fotos", done: (professional?.portfolio_photos?.length ?? 0) >= 3 },
  ];
  const completedCount = checks.filter((c) => c.done).length;
  const completionPercent = Math.round((completedCount / checks.length) * 100);
  const isComplete = completionPercent === 100;
  const canSubmitForApproval = isComplete && (professional?.status === "rascunho" || professional?.status === "rejeitado");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-card rounded-2xl shadow-card p-8 mb-6 animate-fade-in">
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">Seu painel profissional</h1>
          <p className="text-muted-foreground mb-6">Bem-vindo à sua vitrine digital.</p>

          {/* Deactivated Profile Warning */}
          {professional?.status === "desativado" && (
            <div className="mb-6 p-5 rounded-xl bg-destructive/10 border-2 border-destructive/40 flex items-start gap-3 animate-fade-in">
              <Ban className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-base font-bold text-destructive">Perfil desativado por falta de atualização</p>
                <p className="text-sm text-destructive/80 mt-1">
                  Seu perfil foi desativado automaticamente porque não foi atualizado nos últimos 7 meses. 
                  Ele não está mais visível para clientes na vitrine.
                </p>
                <p className="text-sm text-foreground mt-2">
                  Para reativar, atualize seu portfólio e envie para aprovação novamente.
                </p>
                <Button variant="destructive" size="sm" className="mt-3" asChild>
                  <Link to="/editar-perfil">Atualizar e reativar</Link>
                </Button>
              </div>
            </div>
          )}

          {/* Portfolio Update Warning */}
          {portfolioUpdateStatus === "expired" && (
            <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-3 animate-fade-in">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Atualização obrigatória do portfólio</p>
                <p className="text-sm text-destructive/80 mt-1">
                  Faz mais de 6 meses desde a última atualização do seu perfil. Atualize seu portfólio para continuar ativo na vitrine.
                </p>
                <Button variant="destructive" size="sm" className="mt-3" asChild>
                  <Link to="/editar-perfil">Atualizar agora</Link>
                </Button>
              </div>
            </div>
          )}
          {portfolioUpdateStatus === "warning" && (
            <div className="mb-6 p-4 rounded-xl bg-yellow-50 border border-yellow-300 flex items-start gap-3 animate-fade-in">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">Seu portfólio precisa ser atualizado em breve</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Atualize seu perfil e portfólio para manter seu perfil ativo na vitrine. A atualização é obrigatória a cada 6 meses.
                </p>
                <Button variant="outline" size="sm" className="mt-3 border-yellow-400 text-yellow-800 hover:bg-yellow-100" asChild>
                  <Link to="/editar-perfil">Atualizar portfólio</Link>
                </Button>
              </div>
            </div>
          )}

          {/* Profile Completion */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">Perfil completo</span>
              <span className="text-sm font-bold text-primary">{completionPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full gradient-primary rounded-full transition-all duration-500"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-3 mb-8">
            {checks.map((check) => (
              <div key={check.label} className="flex items-center gap-3">
                {check.done ? (
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
                <span className={`text-sm ${check.done ? "text-foreground" : "text-muted-foreground"}`}>
                  {check.label}
                </span>
              </div>
            ))}
          </div>

          {/* Rejection Warning */}
          {professional?.status === "rejeitado" && (
            <div className="mb-6 p-5 rounded-xl bg-destructive/10 border-2 border-destructive/40 flex items-start gap-3 animate-fade-in">
              <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-base font-bold text-destructive">Rejeitado, aguardando correção</p>
                {professional.rejection_reason && (
                  <div className="mt-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <p className="text-sm font-semibold text-destructive/90 mb-1">Motivo da rejeição:</p>
                    <p className="text-sm text-foreground">{professional.rejection_reason}</p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  Corrija os pontos indicados e envie novamente para aprovação.
                </p>
                <Button variant="destructive" size="sm" className="mt-3" asChild>
                  <Link to="/editar-perfil">Corrigir e reenviar</Link>
                </Button>
              </div>
            </div>
          )}

          {/* Status */}
          {professional && (
            <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent text-sm">
              <span className="text-muted-foreground">Status:</span>
              <span className={`font-medium capitalize ${
                professional.status === "desativado" || professional.status === "rejeitado" 
                  ? "text-destructive" 
                  : "text-accent-foreground"
              }`}>
                {professional.status === "desativado" 
                  ? "Desativado por falta de atualização" 
                  : professional.status === "rejeitado"
                  ? "Rejeitado, aguardando correção"
                  : professional.status}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="gradient" asChild>
              <Link to="/editar-perfil">
                <Edit className="h-4 w-4 mr-2" />
                Editar perfil
              </Link>
            </Button>
            {canSubmitForApproval && (
              <Button
                variant="outline"
                onClick={() => submitForApproval.mutate()}
                disabled={submitForApproval.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                {submitForApproval.isPending ? "Enviando..." : "Enviar para aprovação"}
              </Button>
            )}
            {professional?.status === "pendente" && (
              <p className="text-sm text-muted-foreground self-center">Seu perfil está aguardando aprovação do admin.</p>
            )}
            {professional?.slug && professional.status === "publicado" && (
              <Button variant="outline" asChild>
                <Link to={`/p/${professional.slug}`}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Visualizar página pública
                </Link>
              </Button>
            )}
          </div>
        </div>

        <BannerCarousel placement="dashboard" />
      </div>
    </div>
  );
};

export default Dashboard;
