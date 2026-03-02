import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, Upload, ArrowLeft, Clock, FileText, Loader2, Check } from "lucide-react";
import ProfileCropDialog from "@/components/ProfileCropDialog";
import PortfolioCropDialog from "@/components/PortfolioCropDialog";
import CertificatesSection from "@/components/CertificatesSection";

const PAYMENT_OPTIONS = ["Pix", "Cartão de Crédito", "Cartão de Débito", "Dinheiro", "Transferência Bancária"];

const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const EditProfile = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "", bio: "", country: "Brasil", state: "", city: "",
    address_street: "", address_number: "", address_neighborhood: "",
    address_complement: "", whatsapp_number: "", payment_methods: [] as string[],
    slug: "",
  });
  const [slugError, setSlugError] = useState("");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const formInitialized = useRef(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [services, setServices] = useState<{ id?: string; title: string; price: string; priceOnRequest: boolean }[]>([]);
  const [workingHours, setWorkingHours] = useState<{ day: number; enabled: boolean; open: string; close: string }[]>(
    Array.from({ length: 7 }, (_, i) => ({ day: i, enabled: false, open: "10:00", close: "20:00" }))
  );
  const [uploading, setUploading] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [portfolioCropImage, setPortfolioCropImage] = useState<string | null>(null);
  const [pendingPortfolioFiles, setPendingPortfolioFiles] = useState<File[]>([]);
  const [currentPortfolioFileIndex, setCurrentPortfolioFileIndex] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const { data: professional } = useQuery({
    queryKey: ["my-professional-edit", user?.id],
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

  const { data: existingHours } = useQuery({
    queryKey: ["my-working-hours", professional?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("working_hours")
        .select("*")
        .eq("professional_id", professional!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!professional?.id,
  });

  useEffect(() => {
    if (professional) {
      setForm({
        name: professional.name || "",
        bio: professional.bio || "",
        country: professional.country || "Brasil",
        state: professional.state || "",
        city: professional.city || "",
        address_street: professional.address_street || "",
        address_number: professional.address_number || "",
        address_neighborhood: professional.address_neighborhood || "",
        address_complement: professional.address_complement || "",
        whatsapp_number: professional.whatsapp_number || "",
        payment_methods: professional.payment_methods || [],
        slug: professional.slug || "",
      });
      setServices(
        professional.services?.map((s) => ({
          id: s.id,
          title: s.title,
          price: s.price ? String(s.price) : "",
          priceOnRequest: s.price === null || s.price === undefined,
        })) || []
      );
      // Mark as initialized after a short delay to avoid triggering auto-save on load
      setTimeout(() => { formInitialized.current = true; }, 500);
    }
  }, [professional]);

  useEffect(() => {
    if (existingHours) {
      setWorkingHours(
        Array.from({ length: 7 }, (_, i) => {
          const found = existingHours.find((h) => h.day_of_week === i);
          return found
            ? { day: i, enabled: true, open: found.open_time.slice(0, 5), close: found.close_time.slice(0, 5) }
            : { day: i, enabled: false, open: "10:00", close: "20:00" };
        })
      );
    }
  }, [existingHours]);

  const performSave = useCallback(async () => {
    if (!professional) return;

    const cleanSlug = form.slug.toLowerCase().replace(/[^a-z0-9._-]/g, "").replace(/[-_.]{2,}/g, (m) => m[0]).replace(/^[-_.]|[-_.]$/g, "");
    if (!cleanSlug) return; // Don't auto-save without slug

    if (cleanSlug !== professional.slug) {
      const { data: existing } = await supabase
        .from("professionals")
        .select("id")
        .eq("slug", cleanSlug)
        .neq("id", professional.id)
        .maybeSingle();
      if (existing) {
        setSlugError("Este username já está em uso.");
        return;
      }
    }

    const whatsappClean = form.whatsapp_number.replace(/\D/g, "");
    const wasDeactivated = professional.status === "desativado";
    const { error } = await supabase
      .from("professionals")
      .update({
        name: form.name,
        bio: form.bio,
        country: form.country,
        state: form.state,
        city: form.city,
        address_street: form.address_street,
        address_number: form.address_number,
        address_neighborhood: form.address_neighborhood,
        address_complement: form.address_complement,
        whatsapp_number: whatsappClean,
        whatsapp_link: whatsappClean ? `https://wa.me/${whatsappClean}` : null,
        payment_methods: form.payment_methods,
        slug: cleanSlug,
        last_portfolio_update: new Date().toISOString(),
        ...(wasDeactivated ? { status: "rascunho" } : {}),
      })
      .eq("id", professional.id);
    if (error) throw error;

    // Delete existing services and re-insert
    await supabase.from("services").delete().eq("professional_id", professional.id);
    if (services.length > 0) {
      const validServices = services.filter(s => s.title.trim());
      if (validServices.length > 0) {
        const { error: sError } = await supabase.from("services").insert(
          validServices.map((s, i) => ({
            professional_id: professional.id,
            title: s.title,
            price: s.priceOnRequest ? null : (s.price ? Number(s.price) : null),
            duration_minutes: null,
            order_index: i,
          }))
        );
        if (sError) throw sError;
      }
    }

    // Save working hours
    await supabase.from("working_hours").delete().eq("professional_id", professional.id);
    const enabledHours = workingHours.filter((h) => h.enabled);
    if (enabledHours.length > 0) {
      const { error: whError } = await supabase.from("working_hours").insert(
        enabledHours.map((h) => ({
          professional_id: professional.id,
          day_of_week: h.day,
          open_time: h.open,
          close_time: h.close,
        }))
      );
      if (whError) throw whError;
    }
  }, [form, services, workingHours, professional]);

  // Auto-save with debounce
  useEffect(() => {
    if (!formInitialized.current || !professional) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaveStatus("saving");
      try {
        await performSave();
        setAutoSaveStatus("saved");
        queryClient.invalidateQueries({ queryKey: ["my-professional-edit"] });
        queryClient.invalidateQueries({ queryKey: ["my-professional"] });
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      } catch (err: any) {
        setAutoSaveStatus("idle");
        toast.error(err.message || "Erro ao salvar automaticamente.");
      }
    }, 1500);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [form, services, workingHours, professional, performSave, queryClient]);

  const saveMutation = useMutation({
    mutationFn: performSave,
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["my-professional-edit"] });
      queryClient.invalidateQueries({ queryKey: ["my-professional"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar."),
  });

  const uploadToR2 = async (file: File, path: string): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("path", path);

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/upload-to-r2`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro no upload");
    }

    const data = await res.json();
    return data.url;
  };

  const processFileForCrop = (file: File, setter: (src: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFileForCrop(file, setCropImage);
    e.target.value = "";
  };

  const handleProfileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    processFileForCrop(file, setCropImage);
  };

  const handleCropComplete = async (blob: Blob) => {
    setCropImage(null);
    if (!professional) return;
    setUploading(true);
    try {
      const path = `${professional.id}/profile.jpg`;
      const publicUrl = await uploadToR2(new File([blob], "profile.jpg", { type: "image/jpeg" }), path);
      // Append cache-buster so browser loads the new image
      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;
      await supabase.from("professionals").update({ profile_photo_url: urlWithCacheBust }).eq("id", professional.id);
      toast.success("Foto de perfil atualizada!");
      queryClient.invalidateQueries({ queryKey: ["my-professional-edit"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar foto.");
    } finally {
      setUploading(false);
    }
  };

  const handlePortfolioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!professional) {
      toast.error("Perfil profissional não encontrado. Recarregue a página.");
      return;
    }
    const currentCount = professional.portfolio_photos?.length ?? 0;
    if (currentCount + files.length > 10) {
      toast.error("Máximo de 10 fotos no portfólio.");
      return;
    }
    const fileList = Array.from(files);
    setPendingPortfolioFiles(fileList);
    setCurrentPortfolioFileIndex(0);
    processFileForCrop(fileList[0], setPortfolioCropImage);
    e.target.value = "";
  };

  const handlePortfolioDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    if (!professional) {
      toast.error("Perfil profissional não encontrado.");
      return;
    }
    const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    const currentCount = professional.portfolio_photos?.length ?? 0;
    if (currentCount + imageFiles.length > 10) {
      toast.error("Máximo de 10 fotos no portfólio.");
      return;
    }
    setPendingPortfolioFiles(imageFiles);
    setCurrentPortfolioFileIndex(0);
    processFileForCrop(imageFiles[0], setPortfolioCropImage);
  };

  const handlePortfolioCropComplete = async (blob: Blob) => {
    setPortfolioCropImage(null);
    if (!professional) return;

    const currentCount = professional.portfolio_photos?.length ?? 0;
    const idx = currentPortfolioFileIndex;

    setUploading(true);
    try {
      const path = `${professional.id}/portfolio-${Date.now()}-${idx}.jpg`;
      const publicUrl = await uploadToR2(new File([blob], "portfolio.jpg", { type: "image/jpeg" }), path);
      await supabase.from("portfolio_photos").insert({
        professional_id: professional.id,
        photo_url: publicUrl,
        order_index: currentCount + idx,
      });
      queryClient.invalidateQueries({ queryKey: ["my-professional-edit"] });

      // Process next file if any
      const nextIndex = idx + 1;
      if (nextIndex < pendingPortfolioFiles.length) {
        setCurrentPortfolioFileIndex(nextIndex);
        const reader = new FileReader();
        reader.onload = () => setPortfolioCropImage(reader.result as string);
        reader.readAsDataURL(pendingPortfolioFiles[nextIndex]);
      } else {
        setPendingPortfolioFiles([]);
        toast.success("Fotos adicionadas ao portfólio!");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar foto.");
      setPendingPortfolioFiles([]);
    } finally {
      setUploading(false);
    }
  };

  const deletePortfolioPhoto = async (photoId: string) => {
    await supabase.from("portfolio_photos").delete().eq("id", photoId);
    queryClient.invalidateQueries({ queryKey: ["my-professional-edit"] });
    toast.success("Foto removida.");
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-card rounded-2xl shadow-card p-8 animate-fade-in">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">
            Edite suas informações profissionais
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            Mantenha seu perfil atualizado para atrair mais clientes.
          </p>

          {/* Auto-save indicator */}
          <div className="flex items-center gap-2 mb-4 h-5">
            {autoSaveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-fade-in">
                <Loader2 className="h-3 w-3 animate-spin" />
                Salvando rascunho...
              </span>
            )}
            {autoSaveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-xs text-primary animate-fade-in">
                <Check className="h-3 w-3" />
                Rascunho salvo
              </span>
            )}
          </div>

          {/* Profile Photo */}
          <div className="mb-8">
            <label className="text-sm font-medium text-foreground mb-2 block">Foto de perfil</label>
            <div
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleProfileDrop}
            >
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
                {professional?.profile_photo_url ? (
                  <img src={professional.profile_photo_url} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-xl font-display">
                    {form.name.charAt(0) || "?"}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-1" />
                      {uploading ? "Enviando..." : "Alterar foto"}
                    </span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                </label>
                <p className="text-xs text-muted-foreground">ou arraste uma imagem aqui</p>
              </div>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-6">
            {/* Main Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-foreground mb-1.5 block">Nome profissional / Nome do salão</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-foreground mb-1.5 block">Username (link do perfil)</label>
                <div className="flex items-center gap-0">
                  <span className="text-sm text-muted-foreground whitespace-nowrap bg-muted px-3 h-10 flex items-center rounded-l-lg border border-r-0 border-input">/p/</span>
                  <Input
                    value={form.slug}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "");
                      setForm({ ...form, slug: val });
                      setSlugError("");
                    }}
                    className="rounded-l-none"
                    placeholder="seu-username"
                  />
                </div>
                {slugError && <p className="text-xs text-destructive mt-1">{slugError}</p>}
                <p className="text-xs text-muted-foreground mt-1">Seu perfil ficará em: /p/{form.slug || "..."}</p>
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-foreground mb-1.5 block">Bio (até 300 caracteres)</label>
                <Textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value.slice(0, 300) })}
                  maxLength={300}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">{form.bio.length}/300</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Estado</label>
                <select
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione</option>
                  {BRAZILIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Cidade *</label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Rua</label>
                <Input value={form.address_street} onChange={(e) => setForm({ ...form, address_street: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Número</label>
                <Input value={form.address_number} onChange={(e) => setForm({ ...form, address_number: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Bairro</label>
                <Input value={form.address_neighborhood} onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Complemento</label>
                <Input value={form.address_complement} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-foreground mb-1.5 block">WhatsApp (com DDI e DDD) *</label>
                <Input
                  placeholder="5511999999999"
                  value={form.whatsapp_number}
                  onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Services */}
            <div>
              <h3 className="text-base font-display font-semibold text-foreground mb-3">Serviços</h3>
              <div className="space-y-3">
                {services.map((service, i) => (
                  <div key={i} className="flex flex-col gap-2 p-3 rounded-lg border border-border">
                    <div className="flex gap-2 items-center">
                      <Input
                        placeholder="Nome do serviço"
                        value={service.title}
                        onChange={(e) => {
                          const updated = [...services];
                          updated[i] = { ...updated[i], title: e.target.value };
                          setServices(updated);
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setServices(services.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={service.priceOnRequest}
                          onCheckedChange={(checked) => {
                            const updated = [...services];
                            updated[i] = { ...updated[i], priceOnRequest: !!checked, price: checked ? "" : updated[i].price };
                            setServices(updated);
                          }}
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">A consultar</span>
                      </label>
                      {!service.priceOnRequest && (
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                          <Input
                            placeholder="0,00"
                            type="number"
                            value={service.price}
                            onChange={(e) => {
                              const updated = [...services];
                              updated[i] = { ...updated[i], price: e.target.value };
                              setServices(updated);
                            }}
                            className="pl-9"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setServices([...services, { title: "", price: "", priceOnRequest: false }])}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar serviço
              </Button>
            </div>

            {/* Working Hours */}
            <div>
              <h3 className="text-base font-display font-semibold text-foreground mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horários de atendimento
              </h3>
              <div className="space-y-2">
                {["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map((dayName, i) => {
                  const h = workingHours[i];
                  return (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <Checkbox
                        checked={h.enabled}
                        onCheckedChange={(checked) => {
                          const updated = [...workingHours];
                          updated[i] = { ...updated[i], enabled: !!checked };
                          setWorkingHours(updated);
                        }}
                      />
                      <span className="text-sm text-foreground w-20">{dayName}</span>
                      {h.enabled ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={h.open}
                            onChange={(e) => {
                              const updated = [...workingHours];
                              updated[i] = { ...updated[i], open: e.target.value };
                              setWorkingHours(updated);
                            }}
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          />
                          <span className="text-sm text-muted-foreground">às</span>
                          <input
                            type="time"
                            value={h.close}
                            onChange={(e) => {
                              const updated = [...workingHours];
                              updated[i] = { ...updated[i], close: e.target.value };
                              setWorkingHours(updated);
                            }}
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Fechado</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment Methods */}
            <div>
              <h3 className="text-base font-display font-semibold text-foreground mb-3">Formas de pagamento</h3>
              <div className="grid grid-cols-2 gap-3">
                {PAYMENT_OPTIONS.map((method) => (
                  <label key={method} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.payment_methods.includes(method)}
                      onCheckedChange={(checked) => {
                        setForm({
                          ...form,
                          payment_methods: checked
                            ? [...form.payment_methods, method]
                            : form.payment_methods.filter((m) => m !== method),
                        });
                      }}
                    />
                    <span className="text-sm text-foreground">{method}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Portfolio */}
            <div>
              <h3 className="text-base font-display font-semibold text-foreground mb-1">
                Portfólio ({professional?.portfolio_photos?.length ?? 0}/10 fotos)
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Mínimo de 3 fotos obrigatórias para publicação.
              </p>
              {(professional?.portfolio_photos?.length ?? 0) < 3 && (
                <div className="mb-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive flex items-center gap-2">
                  <span>⚠️</span>
                  Adicione pelo menos {3 - (professional?.portfolio_photos?.length ?? 0)} foto(s) para completar o portfólio.
                </div>
              )}
              {professional?.portfolio_photos && professional.portfolio_photos.length > 0 && (
                <div className="space-y-3 mb-3">
                  {professional.portfolio_photos
                    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                    .map((photo) => (
                    <div key={photo.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                        <img src={photo.photo_url} alt="Portfolio" className="w-full h-full object-cover" />
                      </div>
                      <Input
                        placeholder="Título da foto (opcional)"
                        defaultValue={photo.title || ""}
                        onBlur={async (e) => {
                          const newTitle = e.target.value.trim();
                          if (newTitle !== (photo.title || "")) {
                            await supabase.from("portfolio_photos").update({ title: newTitle || null }).eq("id", photo.id);
                            queryClient.invalidateQueries({ queryKey: ["my-professional-edit"] });
                          }
                        }}
                        className="flex-1 text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => deletePortfolioPhoto(photo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div
                className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handlePortfolioDrop}
                onClick={() => document.getElementById('portfolio-file-input')?.click()}
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  Clique ou arraste fotos aqui
                </p>
              </div>
              <input id="portfolio-file-input" type="file" accept="image/*" multiple className="hidden" onChange={handlePortfolioUpload} disabled={uploading} />
            </div>

            {/* Certificates */}
            <CertificatesSection professionalId={professional?.id} userId={user?.id} />

            <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        </div>
      </div>
      {cropImage && (
        <ProfileCropDialog
          open={!!cropImage}
          imageSrc={cropImage}
          onClose={() => setCropImage(null)}
          onCropComplete={handleCropComplete}
        />
      )}
      {portfolioCropImage && (
        <PortfolioCropDialog
          open={!!portfolioCropImage}
          imageSrc={portfolioCropImage}
          onClose={() => {
            setPortfolioCropImage(null);
            setPendingPortfolioFiles([]);
          }}
          onCropComplete={handlePortfolioCropComplete}
        />
      )}
    </div>
  );
};

export default EditProfile;
