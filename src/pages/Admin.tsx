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
import { CheckCircle2, XCircle, Eye, Pause, Play, Clock, Award, MapPin, CreditCard, MessageCircle, FileText, Copy, Mail } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import AdminBannerManager from "@/components/AdminBannerManager";
import AdminInviteManager from "@/components/AdminInviteManager";
import AdminCollaboratorManager from "@/components/AdminCollaboratorManager";

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
  const [sealDialogOpen, setSealDialogOpen] = useState(false);
  const [sealProId, setSealProId] = useState<string | null>(null);
  const [previewPro, setPreviewPro] = useState<any | null>(null);

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

      if (filter !== "todos") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch emails from profiles table for all professionals
      if (data && data.length > 0) {
        const userIds = data.map((p) => p.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email")
          .in("user_id", userIds);
        const emailMap = new Map(profiles?.map((p) => [p.user_id, p.email]) ?? []);
        return data.map((p) => ({ ...p, _email: emailMap.get(p.user_id) || null }));
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
    },
    onSuccess: () => {
      toast.success("Status atualizado!");
      queryClient.invalidateQueries({ queryKey: ["admin-professionals"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar."),
  });

  if (authLoading || roleLoading || !hasAccess) return null;

  const handleReject = (id: string) => {
    setRejectingId(id);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (!rejectingId || !rejectionReason.trim()) {
      toast.error("Informe o motivo da rejeição.");
      return;
    }
    updateStatus.mutate({ id: rejectingId, status: "rascunho", reason: rejectionReason.trim() });
    setRejectDialogOpen(false);
    setRejectingId(null);
  };

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
              {professionals.map((rawPro) => {
                const pro = rawPro as typeof rawPro & { _email?: string | null };
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
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(pro._email); toast.success("Email copiado!"); }}
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
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>

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
                      {pro.status === "publicado" && canApprove && (
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPreviewPro(pro)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
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
      </div>

      {/* Rejection reason dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo da rejeição</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Informe o motivo da rejeição para o profissional..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
          />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? "Rejeitando..." : "Confirmar rejeição"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Seal management dialog */}
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
            <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg px-3 py-2 text-xs font-medium mt-2">
              ⚠️ Este perfil ainda NÃO está publicado — Status: {STATUS_LABELS[previewPro?.status]?.label || previewPro?.status}
            </div>
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
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
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
                    <span>WhatsApp: {previewPro.whatsapp_number}</span>
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
                          onClick={async () => {
                            const { data } = await supabase.storage
                              .from("certificates")
                              .createSignedUrl(cert.file_url, 300);
                            if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                          }}
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
    </div>
  );
};

export default Admin;
