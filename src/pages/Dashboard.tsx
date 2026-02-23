import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, Circle, Edit, ExternalLink, Send } from "lucide-react";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

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

  if (authLoading || !user) return null;

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
  const canSubmitForApproval = isComplete && professional?.status === "rascunho";

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
      toast.success("Perfil enviado para aprovação!");
      queryClient.invalidateQueries({ queryKey: ["my-professional"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao enviar para aprovação."),
  });
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-card rounded-2xl shadow-card p-8 mb-6 animate-fade-in">
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">Seu painel profissional</h1>
          <p className="text-muted-foreground mb-6">Bem-vindo à sua vitrine digital.</p>

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

          {/* Status */}
          {professional && (
            <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent text-sm">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium text-accent-foreground capitalize">{professional.status}</span>
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
      </div>
    </div>
  );
};

export default Dashboard;
