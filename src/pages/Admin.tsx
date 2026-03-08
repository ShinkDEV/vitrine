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
import { CheckCircle2, XCircle, Eye, Pause, Play, Clock, Award, MapPin, CreditCard, MessageCircle, FileText, Copy, Mail, ExternalLink, GitCompare, GraduationCap, Trash2, ShieldBan } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import AdminBannerManager from "@/components/AdminBannerManager";
import AdminInviteManager from "@/components/AdminInviteManager";
import AdminCollaboratorManager from "@/components/AdminCollaboratorManager";
import AdminSealManager from "@/components/AdminSealManager";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  pendente: { label: "Aguardando Aprovação", color: "bg-yellow-100 text-yellow-800" },
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
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [pauseReason, setPauseReason] = useState("");
  const [sealDialogOpen, setSealDialogOpen] = useState(false);
  const [sealProId, setSealProId] = useState<string | null>(null);
  const [previewPro, setPreviewPro] = useState<any | null>(null);
  const [compareProId, setCompareProId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPro, setDeletingPro] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [blockUser, setBlockUser] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Check if user is admin or colaborador
  const { data: userRoles, isLoading: roleLoading } = useQuery({
    queryKey: ["is-admin-or-colaborador", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .in("role", ["admin", "colaborador"]);
      if (error) throw error;
      return data?.map((r) => r.role) ?? [];
    },
    enabled: !!user,
  });

  const hasAccess = (userRoles?.length ?? 0) > 0;
  const isAdmin = userRoles?.includes("admin") ?? false;

  // Fetch collaborator permissions (only for non-admins)
  const { data: collabPerms } = useQuery({
    queryKey: ["my-collab-permissions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collaborator_permissions")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && hasAccess && !isAdmin,
  });

  // Permission helpers — admin has all permissions
  const canApprove = isAdmin || (collabPerms?.can_approve_profiles ?? false);
  const canManageSeals = isAdmin || (collabPerms?.can_manage_seals ?? false);
  const canManageInvites = isAdmin || (collabPerms?.can_manage_invites ?? false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
    if (!authLoading && !roleLoading && user && !hasAccess) {
      toast.error("Acesso negado.");
      navigate("/dashboard");
    }
  }, [user, authLoading, hasAccess, roleLoading, navigate]);
  

  // Fetch professionals
  const { data: professionals, isLoading } = useQuery({
    queryKey: ["admin-professionals", filter],
    queryFn: async () => {
      let query = supabase
        .from("professionals")
        .select("*, services(*), portfolio_photos(*)")
        .order("updated_at", { ascending: false });

      if (filter === "com-alteracoes") {
        // Special filter: published profiles with pending changes
        query = query.eq("status", "publicado");
      } else if (filter !== "todos") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = data.map((p) => p.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email")
          .in("user_id", userIds);
        const emailMap = new Map(profiles?.map((p) => [p.user_id, p.email]) ?? []);

        // Fetch pending changes for all professionals
        const proIds = data.map((p) => p.id);
        const { data: pendingAll } = await supabase
          .from("pending_changes")
          .select("professional_id, updated_at")
          .in("professional_id", proIds);
        const pendingMap = new Map(pendingAll?.map((p) => [p.professional_id, p.updated_at]) ?? []);

        let result = data.map((p) => ({
          ...p,
          _email: emailMap.get(p.user_id) || null,
          _hasPending: pendingMap.has(p.id),
          _pendingDate: pendingMap.get(p.id) || null,
        }));

        // If filtering by pending changes, only show those
        if (filter === "com-alteracoes") {
          result = result.filter((p) => p._hasPending);
        }

        return result;
      }

      return data;
    },
    enabled: !!hasAccess,
  });

  // Fetch all seals
  const { data: allSeals } = useQuery({
    queryKey: ["all-seals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("seals").select("*").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!hasAccess,
  });

  // Fetch assigned seals for the selected professional
  const { data: assignedSeals } = useQuery({
    queryKey: ["professional-seals-admin", sealProId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_seals")
        .select("seal_id")
        .eq("professional_id", sealProId!);
      if (error) throw error;
      return data?.map((s) => s.seal_id) ?? [];
    },
    enabled: !!sealProId,
  });

  // Fetch certificates for previewed professional
  const { data: previewCertificates } = useQuery({
    queryKey: ["professional-certificates-admin", previewPro?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_certificates")
        .select("*")
        .eq("professional_id", previewPro!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!previewPro?.id,
  });

  // Fetch courses for previewed professional
  const { data: previewCourses } = useQuery({
    queryKey: ["professional-courses-admin", previewPro?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_courses")
        .select("*")
        .eq("professional_id", previewPro!.id)
        .order("course_year", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!previewPro?.id,
  });

  // Fetch working hours for previewed professional
  const { data: previewWorkingHours } = useQuery({
    queryKey: ["professional-hours-admin", previewPro?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("working_hours")
        .select("*")
        .eq("professional_id", previewPro!.id)
        .order("day_of_week");
      if (error) throw error;
      return data;
    },
    enabled: !!previewPro?.id,
  });

  // Fetch pending changes for comparison
  const { data: pendingChangeData } = useQuery({
    queryKey: ["pending-change-detail", compareProId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_changes")
        .select("*")
        .eq("professional_id", compareProId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!compareProId,
  });

  // Fetch current data for comparison
  const { data: currentProData } = useQuery({
    queryKey: ["current-pro-detail", compareProId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("*, services(*), portfolio_photos(*)")
        .eq("id", compareProId!)
        .maybeSingle();
      if (error) throw error;
      // Also get working hours
      const { data: hours } = await supabase
        .from("working_hours")
        .select("*")
        .eq("professional_id", compareProId!);
      return { ...data, _working_hours: hours || [] };
    },
    enabled: !!compareProId,
  });

  const toggleSeal = useMutation({
    mutationFn: async ({ proId, sealId, assign }: { proId: string; sealId: string; assign: boolean }) => {
      if (assign) {
        const { error } = await supabase.from("professional_seals").insert({
          professional_id: proId,
          seal_id: sealId,
          assigned_by: user!.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("professional_seals")
          .delete()
          .eq("professional_id", proId)
          .eq("seal_id", sealId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professional-seals-admin", sealProId] });
      toast.success("Selo atualizado!");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar selo."),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const updateData: Record<string, any> = { status };
      if (reason !== undefined) updateData.rejection_reason = reason;
      if (status === "publicado") updateData.rejection_reason = null;
      const { error } = await supabase
        .from("professionals")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;

      // Send approval email when publishing
      if (status === "publicado") {
        try {
          const { data: pro } = await supabase
            .from("professionals")
            .select("name, slug, user_id")
            .eq("id", id)
            .single();
          if (pro) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("email")
              .eq("user_id", pro.user_id)
              .maybeSingle();
            if (profile?.email) {
              const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
              await fetch(`https://${projectId}.supabase.co/functions/v1/send-profile-published-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: pro.name, email: profile.email, slug: pro.slug }),
              });
            }
          }
        } catch (e) {
          console.error("Failed to send approval email:", e);
        }
      }

      // Send paused email
      if (status === "pausado") {
        try {
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          await fetch(`https://${projectId}.supabase.co/functions/v1/send-paused-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ professional_id: id, reason }),
          });
        } catch (e) {
          console.error("Failed to send paused email:", e);
        }
      }
    },
    onSuccess: () => {
      toast.success("Status atualizado!");
      queryClient.invalidateQueries({ queryKey: ["admin-professionals"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar."),
  });

  const approvePendingChanges = useMutation({
    mutationFn: async (professionalId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/approve-changes`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ professional_id: professionalId }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao aprovar");
      }
    },
    onSuccess: () => {
      toast.success("Alterações aprovadas e aplicadas!");
      setCompareProId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-professionals"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao aprovar alterações."),
  });

  const rejectPendingChanges = useMutation({
    mutationFn: async (professionalId: string) => {
      const { error } = await supabase
        .from("pending_changes")
        .delete()
        .eq("professional_id", professionalId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alterações rejeitadas.");
      setCompareProId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-professionals"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao rejeitar."),
  });

  if (authLoading || roleLoading || !hasAccess) return null;

  const handleReject = (id: string) => {
    setRejectingId(id);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectingId || !rejectionReason.trim()) {
      toast.error("Informe o motivo da rejeição.");
      return;
    }
    updateStatus.mutate(
      { id: rejectingId, status: "rejeitado", reason: rejectionReason.trim() },
      {
        onSuccess: async () => {
          // Send rejection email
          try {
            const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
            await fetch(`https://${projectId}.supabase.co/functions/v1/send-rejection-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ professional_id: rejectingId, reason: rejectionReason.trim() }),
            });
          } catch (e) {
            console.error("Failed to send rejection email:", e);
          }
        },
      }
    );
    setRejectDialogOpen(false);
    setRejectingId(null);
  };

  const filters = [
    { value: "pendente", label: "Aguardando Aprovação" },
    { value: "com-alteracoes", label: "Com Alterações Pendentes" },
    { value: "publicado", label: "Publicados" },
    { value: "pausado", label: "Pausados" },
    { value: "rascunho", label: "Rascunhos" },
    { value: "todos", label: "Todos" },
  ];

  const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const renderCompareField = (label: string, current: any, pending: any) => {
    const changed = JSON.stringify(current) !== JSON.stringify(pending);
    if (!changed && !current && !pending) return null;
    return (
      <div className={`grid grid-cols-2 gap-3 p-2 rounded ${changed ? "bg-yellow-50 border border-yellow-200" : ""}`}>
        <div>
          <span className="text-xs font-medium text-muted-foreground">{label} (atual)</span>
          <p className="text-sm text-foreground">{current || "—"}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-muted-foreground">{label} (novo)</span>
          <p className={`text-sm ${changed ? "text-primary font-medium" : "text-foreground"}`}>{pending || "—"}</p>
        </div>
      </div>
    );
  };

  const pendingData = pendingChangeData?.data as any;

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
              {professionals.map((rawPro) => {
                const pro = rawPro as typeof rawPro & { _email?: string | null; _hasPending?: boolean; _pendingDate?: string | null };
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
                        {pro._email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">{pro._email}</span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(pro._email!); toast.success("Email copiado!"); }}
                              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {pro.city && pro.state ? `${pro.city}, ${pro.state}` : "Localização não definida"}
                          {" · "}
                          {pro.services?.length ?? 0} serviço(s)
                          {" · "}
                          {pro.portfolio_photos?.length ?? 0} foto(s)
                        </p>
                        {pro._hasPending && (
                          <span className="text-xs text-primary font-medium">📝 Alterações pendentes</span>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      {pro.status === "pendente" && pro.rejection_reason?.startsWith("[REATIVAÇÃO]") && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 whitespace-nowrap">
                          Pausado
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      {pro.status === "pendente" && canApprove && (
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
                            onClick={() => handleReject(pro.id)}
                            disabled={updateStatus.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeitar
                          </Button>
                        </>
                      )}
                      {pro._hasPending && canApprove && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-primary border-primary/20 hover:bg-primary/5"
                          onClick={() => setCompareProId(pro.id)}
                        >
                          <GitCompare className="h-4 w-4 mr-1" />
                          Comparar
                        </Button>
                      )}
                      {pro.status === "publicado" && canApprove && !pro._hasPending && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPausingId(pro.id);
                            setPauseReason("");
                            setPauseDialogOpen(true);
                          }}
                          disabled={updateStatus.isPending}
                        >
                          <Pause className="h-4 w-4 mr-1" />
                          Pausar
                        </Button>
                      )}
                      {pro.status === "pausado" && canApprove && (
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
                      {canManageSeals && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setSealProId(pro.id); setSealDialogOpen(true); }}
                        >
                          <Award className="h-4 w-4" />
                        </Button>
                      )}
                      {pro.status === "publicado" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                        >
                          <a href={`/p/${pro.slug}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPreviewPro(pro)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeletingPro(pro);
                            setDeleteReason("");
                            setBlockUser(false);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
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

      <div className="container mx-auto px-4 pb-8 max-w-4xl space-y-8">
        {isAdmin && <AdminCollaboratorManager />}
        {canManageInvites && <AdminInviteManager />}
        {isAdmin && <AdminBannerManager />}
        {canManageSeals && <AdminSealManager />}
      </div>

      {/* Rejection reason dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo da rejeição</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select
              value={rejectionReason}
              onValueChange={(val) => {
                if (val === "__custom__") {
                  setRejectionReason("");
                } else {
                  setRejectionReason(val);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um motivo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cumpra TODOS os requisitos conforme explicado no módulo da plataforma!">Cumpra TODOS os requisitos</SelectItem>
                <SelectItem value="Foto de perfil não atende ao padrão solicitado">Foto de perfil inadequada</SelectItem>
                <SelectItem value="Certificados inválidos">Certificados inválidos</SelectItem>
                <SelectItem value="Formação não encontrada no email cadastrado.">Formação não encontrada</SelectItem>
                <SelectItem value="Serviços oferecidos não estão claros.">Serviços não claros</SelectItem>
                <SelectItem value="Fotos do Portfólio não atendem os requisitos">Portfólio inadequado</SelectItem>
                <SelectItem value="Endereço inexistente">Endereço inexistente</SelectItem>
                <SelectItem value="__custom__">Outro (escrever motivo)</SelectItem>
              </SelectContent>
            </Select>
            {(rejectionReason === "" || !([
              "Cumpra TODOS os requisitos conforme explicado no módulo da plataforma!",
              "Foto de perfil não atende ao padrão solicitado",
              "Certificados inválidos",
              "Formação não encontrada no email cadastrado.",
              "Serviços oferecidos não estão claros.",
              "Fotos do Portfólio não atendem os requisitos",
              "Endereço inexistente",
            ].includes(rejectionReason))) && (
              <Textarea
                placeholder="Informe o motivo da rejeição..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? "Rejeitando..." : "Confirmar rejeição"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pause reason dialog */}
      <Dialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo da pausa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Informe o motivo da pausa..."
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setPauseDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!pausingId || !pauseReason.trim()) {
                  toast.error("Informe o motivo da pausa.");
                  return;
                }
                updateStatus.mutate({ id: pausingId, status: "pausado", reason: pauseReason.trim() });
                setPauseDialogOpen(false);
                setPausingId(null);
              }}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? "Pausando..." : "Confirmar pausa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete / Block dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Deletar perfil
            </DialogTitle>
          </DialogHeader>
          {deletingPro && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Você está prestes a deletar permanentemente o perfil de <strong>{deletingPro.name}</strong> e sua conta de acesso.
              </p>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Motivo da exclusão *</label>
                <Textarea
                  placeholder="Informe o motivo da exclusão..."
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <Checkbox
                  id="block-user"
                  checked={blockUser}
                  onCheckedChange={(v) => setBlockUser(v === true)}
                />
                <div>
                  <label htmlFor="block-user" className="text-sm font-medium text-foreground cursor-pointer flex items-center gap-1.5">
                    <ShieldBan className="h-4 w-4 text-destructive" />
                    Bloquear este usuário
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Impede que este e-mail{deletingPro.cpf ? " e CPF" : ""} criem uma nova conta.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  disabled={deleteLoading || !deleteReason.trim()}
                  onClick={async () => {
                    if (!deleteReason.trim()) {
                      toast.error("Informe o motivo da exclusão.");
                      return;
                    }
                    setDeleteLoading(true);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session) throw new Error("Não autenticado");
                      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
                      const res = await fetch(
                        `https://${projectId}.supabase.co/functions/v1/delete-profile`,
                        {
                          method: "POST",
                          headers: {
                            Authorization: `Bearer ${session.access_token}`,
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            professional_id: deletingPro.id,
                            reason: deleteReason.trim(),
                            block: blockUser,
                            block_email: deletingPro._email,
                            block_cpf: deletingPro.cpf,
                          }),
                        }
                      );
                      if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error || "Erro ao deletar");
                      }
                      toast.success("Perfil deletado com sucesso.");
                      setDeleteDialogOpen(false);
                      setDeletingPro(null);
                      queryClient.invalidateQueries({ queryKey: ["admin-professionals"] });
                    } catch (err: any) {
                      toast.error(err.message || "Erro ao deletar perfil.");
                    } finally {
                      setDeleteLoading(false);
                    }
                  }}
                >
                  {deleteLoading ? "Deletando..." : "Deletar permanentemente"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={sealDialogOpen} onOpenChange={(v) => { setSealDialogOpen(v); if (!v) setSealProId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Gerenciar Selos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {allSeals?.map((seal) => {
              const isAssigned = assignedSeals?.includes(seal.id) ?? false;
              return (
                <label key={seal.id} className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={isAssigned}
                    onCheckedChange={(checked) => {
                      if (sealProId) {
                        toggleSeal.mutate({ proId: sealProId, sealId: seal.id, assign: !!checked });
                      }
                    }}
                    disabled={toggleSeal.isPending}
                  />
                  <span className="text-lg">{seal.icon}</span>
                  <span className="text-sm text-foreground">{seal.name}</span>
                </label>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Professional Preview Dialog */}
      <Dialog open={!!previewPro} onOpenChange={(v) => { if (!v) setPreviewPro(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Pré-visualização do Perfil
            </DialogTitle>
            {previewPro?.status === "publicado" ? (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg px-3 py-2 text-xs font-medium mt-2">
                ✅ Perfil Publicado
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg px-3 py-2 text-xs font-medium mt-2">
                ⚠️ Este perfil ainda NÃO está publicado — Status: {STATUS_LABELS[previewPro?.status]?.label || previewPro?.status}
              </div>
            )}
          </DialogHeader>
          {previewPro && (
            <ScrollArea className="max-h-[70vh] px-6 pb-6">
              <div className="space-y-5 pt-4">
                {/* Photo + Name */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
                    {previewPro.profile_photo_url ? (
                      <img src={previewPro.profile_photo_url} alt={previewPro.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground font-display text-2xl">
                        {previewPro.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold text-foreground">{previewPro.name}</h3>
                    {previewPro._email && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{previewPro._email}</span>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(previewPro._email); toast.success("Email copiado!"); }}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {previewPro.city || "—"} / {previewPro.state || "—"}
                    </p>
                    {(previewPro.address_street || previewPro.address_neighborhood) && (
                      <p className="text-xs text-muted-foreground">
                        {[previewPro.address_street, previewPro.address_number, previewPro.address_neighborhood].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                {/* WhatsApp */}
                {previewPro.whatsapp_number && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MessageCircle className="h-4 w-4" />
                    <span>WhatsApp: {(() => {
                      const raw = previewPro.whatsapp_number.replace(/^55/, "");
                      if (raw.length === 11) return `+55 (${raw.slice(0,2)}) ${raw.slice(2,7)}-${raw.slice(7)}`;
                      if (raw.length === 10) return `+55 (${raw.slice(0,2)}) ${raw.slice(2,6)}-${raw.slice(6)}`;
                      return `+55 ${raw}`;
                    })()}</span>
                  </div>
                )}

                {/* Bio */}
                {previewPro.bio && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">Sobre</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{previewPro.bio}</p>
                  </div>
                )}

                {/* Services */}
                {previewPro.services && previewPro.services.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Serviços ({previewPro.services.length})</h4>
                    <div className="space-y-1.5">
                      {previewPro.services
                        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
                        .map((s: any) => (
                          <div key={s.id} className="flex justify-between text-sm border-b border-border pb-1.5 last:border-0">
                            <span className="text-foreground">{s.title}</span>
                            <div className="flex gap-3 text-muted-foreground text-xs">
                              {s.price && (
                                <span className="flex items-center gap-0.5">
                                  R$ {Number(s.price).toFixed(2)}
                                </span>
                              )}
                              {s.duration_minutes && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="h-3 w-3" />
                                  {s.duration_minutes} min
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Payment Methods */}
                {previewPro.payment_methods && previewPro.payment_methods.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Formas de pagamento</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {previewPro.payment_methods.map((m: string) => (
                        <span key={m} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent text-accent-foreground text-xs">
                          <CreditCard className="h-3 w-3" />
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Portfolio Photos */}
                {previewPro.portfolio_photos && previewPro.portfolio_photos.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Portfólio ({previewPro.portfolio_photos.length} fotos)</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {previewPro.portfolio_photos
                        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
                        .map((p: any) => (
                          <div key={p.id} className="aspect-square rounded-lg overflow-hidden">
                            <img src={p.photo_url} alt="Portfólio" className="w-full h-full object-cover" />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Working Hours */}
                {previewWorkingHours && previewWorkingHours.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      Horários de Funcionamento
                    </h4>
                    <div className="space-y-1">
                      {previewWorkingHours.map((h: any) => (
                        <p key={h.id} className="text-sm text-muted-foreground">
                          {DAY_NAMES[h.day_of_week]}: {h.open_time?.slice(0,5)} - {h.close_time?.slice(0,5)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Courses */}
                {previewCourses && previewCourses.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4" />
                      Cursos Realizados ({previewCourses.length})
                    </h4>
                    <div className="space-y-1.5">
                      {previewCourses.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between text-sm border-b border-border pb-1.5 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground">{c.course_name}</span>
                            {c.certificate_url && (
                              <a
                                href={c.certificate_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80 transition-colors"
                                title="Ver certificado"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{c.course_year}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Certificates */}
                {previewCertificates && previewCertificates.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />
                      Certificados ({previewCertificates.length})
                    </h4>
                    <div className="space-y-1.5">
                      {previewCertificates.map((cert: any) => (
                        <button
                          key={cert.id}
                          onClick={() => window.open(cert.file_url, "_blank")}
                          className="flex items-center gap-2 w-full text-left p-2 rounded-lg border border-border hover:bg-accent transition-colors"
                        >
                          <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-sm text-foreground truncate flex-1">{cert.file_name}</span>
                          <span className="text-xs text-muted-foreground">{new Date(cert.created_at).toLocaleDateString("pt-BR")}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin actions */}
                {previewPro.status === "pendente" && canApprove && (
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        updateStatus.mutate({ id: previewPro.id, status: "publicado" });
                        setPreviewPro(null);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => {
                        setPreviewPro(null);
                        handleReject(previewPro.id);
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Rejeitar
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Side-by-side comparison dialog */}
      <Dialog open={!!compareProId} onOpenChange={(v) => { if (!v) setCompareProId(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              Comparação: Atual vs Alterações Pendentes
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Campos destacados em amarelo foram alterados.
            </p>
          </DialogHeader>
          {currentProData && pendingData && (
            <ScrollArea className="max-h-[70vh] px-6 pb-6">
              <div className="space-y-2 pt-4">
                {renderCompareField("Nome", currentProData.name, pendingData.profile?.name)}
                {renderCompareField("Bio", currentProData.bio, pendingData.profile?.bio)}
                {renderCompareField("Estado", currentProData.state, pendingData.profile?.state)}
                {renderCompareField("Cidade", currentProData.city, pendingData.profile?.city)}
                {renderCompareField("Rua", currentProData.address_street, pendingData.profile?.address_street)}
                {renderCompareField("Número", currentProData.address_number, pendingData.profile?.address_number)}
                {renderCompareField("Bairro", currentProData.address_neighborhood, pendingData.profile?.address_neighborhood)}
                {renderCompareField("WhatsApp", currentProData.whatsapp_number, pendingData.profile?.whatsapp_number)}
                {renderCompareField("Username", currentProData.slug, pendingData.profile?.slug)}
                {renderCompareField("Pagamento", currentProData.payment_methods?.join(", "), pendingData.profile?.payment_methods?.join(", "))}

                {/* Services comparison */}
                <div className="border-t border-border pt-3 mt-3">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Serviços</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Atual ({currentProData.services?.length ?? 0})</span>
                      <div className="space-y-1 mt-1">
                        {currentProData.services?.sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)).map((s: any) => (
                          <p key={s.id} className="text-xs text-foreground">
                            {s.title} {s.price ? `— R$${Number(s.price).toFixed(2)}` : ""}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Novo ({pendingData.services?.length ?? 0})</span>
                      <div className="space-y-1 mt-1">
                        {pendingData.services?.map((s: any, i: number) => (
                          <p key={i} className="text-xs text-foreground">
                            {s.title} {s.price ? `— R$${Number(s.price).toFixed(2)}` : ""}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Working hours comparison */}
                <div className="border-t border-border pt-3 mt-3">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Horários</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Atual</span>
                      <div className="space-y-1 mt-1">
                        {currentProData._working_hours?.map((h: any) => (
                          <p key={h.id} className="text-xs text-foreground">
                            {DAY_NAMES[h.day_of_week]}: {h.open_time?.slice(0,5)} - {h.close_time?.slice(0,5)}
                          </p>
                        ))}
                        {(!currentProData._working_hours || currentProData._working_hours.length === 0) && <p className="text-xs text-muted-foreground">—</p>}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Novo</span>
                      <div className="space-y-1 mt-1">
                        {pendingData.working_hours?.map((h: any, i: number) => (
                          <p key={i} className="text-xs text-foreground">
                            {DAY_NAMES[h.day_of_week]}: {h.open_time?.slice(0,5)} - {h.close_time?.slice(0,5)}
                          </p>
                        ))}
                        {(!pendingData.working_hours || pendingData.working_hours.length === 0) && <p className="text-xs text-muted-foreground">—</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Portfolio comparison */}
                <div className="border-t border-border pt-3 mt-3">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Portfólio</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Atual ({currentProData.portfolio_photos?.length ?? 0} fotos)</span>
                      <div className="grid grid-cols-3 gap-1 mt-1">
                        {currentProData.portfolio_photos?.sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)).map((p: any) => (
                          <div key={p.id} className="aspect-square rounded overflow-hidden">
                            <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Novo ({pendingData.portfolio_photos?.length ?? 0} fotos)</span>
                      <div className="grid grid-cols-3 gap-1 mt-1">
                        {pendingData.portfolio_photos?.sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0)).map((p: any, i: number) => (
                          <div key={i} className="aspect-square rounded overflow-hidden">
                            <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-border">
                  <Button size="sm" className="flex-1" onClick={() => approvePendingChanges.mutate(compareProId!)}
                    disabled={approvePendingChanges.isPending}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {approvePendingChanges.isPending ? "Aplicando..." : "Aprovar Alterações"}
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => rejectPendingChanges.mutate(compareProId!)}
                    disabled={rejectPendingChanges.isPending}>
                    <XCircle className="h-4 w-4 mr-1" />
                    Rejeitar Alterações
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
