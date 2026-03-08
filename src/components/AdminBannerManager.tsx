import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { toast } from "sonner";
import { Plus, Trash2, Image, ExternalLink, Pencil, MousePointerClick } from "lucide-react";
import BannerCropDialog from "@/components/BannerCropDialog";

const AdminBannerManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<any | null>(null);
  const [filterPlacement, setFilterPlacement] = useState<string>("home");
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [placement, setPlacement] = useState<string>("home");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);

  const { data: banners, isLoading } = useQuery({
    queryKey: ["admin-banners", filterPlacement],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .eq("placement", filterPlacement)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const deleteBanner = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Banner removido!");
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao remover banner."),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("banners").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar."),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropComplete = (blob: Blob) => {
    setCroppedBlob(blob);
    setCropSrc(null);
  };

  const uploadImage = async (blob: Blob): Promise<string> => {
    const { uploadToStorage } = await import("@/lib/uploadToStorage");
    const path = `banners/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    return uploadToStorage(blob, path);
  };

  const handleCreateBanner = async () => {
    if (!croppedBlob) {
      toast.error("Selecione e recorte uma imagem.");
      return;
    }

    setUploading(true);
    try {
      const url = await uploadImage(croppedBlob);
      const maxOrder = banners?.length ? Math.max(...banners.map((b) => b.order_index)) + 1 : 0;

      const { error } = await supabase.from("banners").insert({
        title: title || null,
        image_url: url,
        link_url: linkUrl || null,
        placement,
        order_index: maxOrder,
        created_by: user!.id,
      });
      if (error) throw error;

      toast.success("Banner criado!");
      closeDialog();
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar banner.");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateBanner = async () => {
    if (!editingBanner) return;
    setUploading(true);
    try {
      const updateData: Record<string, any> = {
        title: title || null,
        link_url: linkUrl || null,
      };

      if (croppedBlob) {
        updateData.image_url = await uploadImage(croppedBlob);
      }

      const { error } = await supabase
        .from("banners")
        .update(updateData)
        .eq("id", editingBanner.id);
      if (error) throw error;

      toast.success("Banner atualizado!");
      closeDialog();
      queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar banner.");
    } finally {
      setUploading(false);
    }
  };

  const openEditDialog = (banner: any) => {
    setEditingBanner(banner);
    setTitle(banner.title || "");
    setLinkUrl(banner.link_url || "");
    setPlacement(banner.placement);
    setCroppedBlob(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingBanner(null);
    setTitle("");
    setLinkUrl("");
    setCroppedBlob(null);
  };

  return (
    <div className="bg-card rounded-2xl shadow-card p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Banners</h2>
          <p className="text-sm text-muted-foreground">Gerencie banners da página inicial e dashboard.</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Banner
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {[
          { value: "home", label: "Página Inicial" },
          { value: "dashboard", label: "Dashboard" },
        ].map((f) => (
          <Button
            key={f.value}
            variant={filterPlacement === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterPlacement(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !banners?.length ? (
        <p className="text-sm text-muted-foreground">Nenhum banner cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {banners.map((banner) => (
            <div key={banner.id} className="border border-border rounded-xl p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="w-40 flex-shrink-0 rounded-lg overflow-hidden">
                <AspectRatio ratio={4 / 1}>
                  <img src={banner.image_url} alt={banner.title || "Banner"} className="w-full h-full object-cover" />
                </AspectRatio>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{banner.title || "Sem título"}</p>
                {banner.link_url && (
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    {banner.link_url}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{banner.is_active ? "Ativo" : "Inativo"}</span>
                  <Switch
                    checked={banner.is_active}
                    onCheckedChange={(checked) => toggleActive.mutate({ id: banner.id, is_active: checked })}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEditDialog(banner)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm("Remover este banner?")) deleteBanner.mutate(banner.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); else setDialogOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBanner ? "Editar Banner" : "Novo Banner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Título (opcional)</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Promoção de verão" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Link (opcional)</label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
            </div>
            {!editingBanner && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Exibir em</label>
                <Select value={placement} onValueChange={setPlacement}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">Página Inicial</SelectItem>
                    <SelectItem value="dashboard">Dashboard (profissionais)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Imagem (1600×400px — proporção 4:1)
                {editingBanner && " — deixe vazio para manter a atual"}
              </label>
              {editingBanner && !croppedBlob && (
                <div className="mb-2 rounded-lg overflow-hidden border border-border">
                  <AspectRatio ratio={4 / 1}>
                    <img src={editingBanner.image_url} alt="Atual" className="w-full h-full object-cover" />
                  </AspectRatio>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Image className="h-4 w-4 mr-1" />
                  {editingBanner ? "Trocar imagem" : "Selecionar imagem"}
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                {croppedBlob && <span className="text-xs text-primary font-medium">✓ Nova imagem recortada</span>}
              </div>
              {croppedBlob && (
                <div className="mt-2 rounded-lg overflow-hidden border border-border">
                  <AspectRatio ratio={4 / 1}>
                    <img src={URL.createObjectURL(croppedBlob)} alt="Preview" className="w-full h-full object-cover" />
                  </AspectRatio>
                </div>
              )}
            </div>
            <Button
              onClick={editingBanner ? handleUpdateBanner : handleCreateBanner}
              disabled={uploading || (!editingBanner && !croppedBlob)}
              className="w-full"
            >
              {uploading ? "Enviando..." : editingBanner ? "Salvar alterações" : "Criar Banner"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BannerCropDialog
        open={!!cropSrc}
        imageSrc={cropSrc || ""}
        onClose={() => setCropSrc(null)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
};

export default AdminBannerManager;
