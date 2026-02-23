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
import { Plus, Trash2, Upload } from "lucide-react";

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

  const [services, setServices] = useState<{ id?: string; title: string; price: string; duration: string }[]>([]);
  const [uploading, setUploading] = useState(false);

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
          duration: s.duration_minutes ? String(s.duration_minutes) : "",
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
            price: s.price ? Number(s.price) : null,
            duration_minutes: s.duration ? Number(s.duration) : null,
            order_index: i,
          }))
        );
        if (sError) throw sError;
      }
    },
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso.");
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !professional) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${professional.id}/profile.${ext}`;
      const publicUrl = await uploadToR2(file, path);
      await supabase.from("professionals").update({ profile_photo_url: publicUrl }).eq("id", professional.id);
      toast.success("Foto de perfil atualizada!");
      queryClient.invalidateQueries({ queryKey: ["my-professional-edit"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar foto.");
    } finally {
      setUploading(false);
    }
  };

  const handlePortfolioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !professional) return;
    const currentCount = professional.portfolio_photos?.length ?? 0;
    if (currentCount + files.length > 10) {
      toast.error("Máximo de 10 fotos no portfólio.");
      return;
    }
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop();
        const path = `${professional.id}/portfolio-${Date.now()}-${i}.${ext}`;
        const publicUrl = await uploadToR2(file, path);
        await supabase.from("portfolio_photos").insert({
          professional_id: professional.id,
          photo_url: publicUrl,
          order_index: currentCount + i,
        });
      }
      toast.success("Fotos adicionadas ao portfólio!");
      queryClient.invalidateQueries({ queryKey: ["my-professional-edit"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar fotos.");
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
                  <div key={i} className="flex gap-2 items-start">
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
                    <Input
                      placeholder="Preço"
                      type="number"
                      value={service.price}
                      onChange={(e) => {
                        const updated = [...services];
                        updated[i] = { ...updated[i], price: e.target.value };
                        setServices(updated);
                      }}
                      className="w-24"
                    />
                    <Input
                      placeholder="Min"
                      type="number"
                      value={service.duration}
                      onChange={(e) => {
                        const updated = [...services];
                        updated[i] = { ...updated[i], duration: e.target.value };
                        setServices(updated);
                      }}
                      className="w-20"
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
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setServices([...services, { title: "", price: "", duration: "" }])}
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
              <label className="cursor-pointer">
                <Button type="button" variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-1" />
                    Adicionar fotos
                  </span>
                </Button>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePortfolioUpload} disabled={uploading} />
              </label>
            </div>

            <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
