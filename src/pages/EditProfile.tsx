import { useState, useEffect } from "react";
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
import { Plus, Trash2, Upload, ArrowLeft } from "lucide-react";
import ProfileCropDialog from "@/components/ProfileCropDialog";
import PortfolioCropDialog from "@/components/PortfolioCropDialog";

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
  });

  const [services, setServices] = useState<{ id?: string; title: string; price: string; priceOnRequest: boolean }[]>([]);
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
      });
      setServices(
        professional.services?.map((s) => ({
          id: s.id,
          title: s.title,
          price: s.price ? String(s.price) : "",
          priceOnRequest: s.price === null || s.price === undefined,
        })) || []
      );
    }
  }, [professional]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!professional) return;

      const whatsappClean = form.whatsapp_number.replace(/\D/g, "");
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
        })
        .eq("id", professional.id);
      if (error) throw error;

      // Delete existing services and re-insert
      await supabase.from("services").delete().eq("professional_id", professional.id);
      if (services.length > 0) {
        const { error: sError } = await supabase.from("services").insert(
          services.map((s, i) => ({
            professional_id: professional.id,
            title: s.title,
            price: s.priceOnRequest ? null : (s.price ? Number(s.price) : null),
            duration_minutes: null,
            order_index: i,
          }))
        );
        if (sError) throw sError;
      }
    },
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
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
    // Load first file for cropping
    const reader = new FileReader();
    reader.onload = () => setPortfolioCropImage(reader.result as string);
    reader.readAsDataURL(fileList[0]);
    e.target.value = "";
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

          {/* Profile Photo */}
          <div className="mb-8">
            <label className="text-sm font-medium text-foreground mb-2 block">Foto de perfil</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border">
                {professional?.profile_photo_url ? (
                  <img src={professional.profile_photo_url} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-xl font-display">
                    {form.name.charAt(0) || "?"}
                  </div>
                )}
              </div>
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-1" />
                    {uploading ? "Enviando..." : "Alterar foto"}
                  </span>
                </Button>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
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
              <h3 className="text-base font-display font-semibold text-foreground mb-3">
                Portfólio ({professional?.portfolio_photos?.length ?? 0}/10 fotos)
              </h3>
              {professional?.portfolio_photos && professional.portfolio_photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                  {professional.portfolio_photos.map((photo) => (
                    <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden group">
                      <img src={photo.photo_url} alt="Portfolio" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => deletePortfolioPhoto(photo.id)}
                        className="absolute inset-0 bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <Trash2 className="h-5 w-5 text-card" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('portfolio-file-input')?.click()}>
                  <Upload className="h-4 w-4 mr-1" />
                  Adicionar fotos
              </Button>
              <input id="portfolio-file-input" type="file" accept="image/*" multiple className="hidden" onChange={handlePortfolioUpload} disabled={uploading} />
            </div>

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
