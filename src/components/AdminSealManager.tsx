import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Award, Plus, Pencil, Trash2, Upload, X } from "lucide-react";
import { uploadToStorage } from "@/lib/uploadToStorage";
import { deleteFromStorage } from "@/lib/deleteFromStorage";

const AdminSealManager = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeal, setEditingSeal] = useState<any>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("⭐");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: seals, isLoading } = useQuery({
    queryKey: ["all-seals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("seals").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveSeal = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nome é obrigatório.");

      let finalImageUrl = imageUrl.trim() || null;

      // Upload new image if selected
      if (imageFile) {
        setUploading(true);
        try {
          const ext = imageFile.name.split(".").pop() || "png";
          const path = `seals/${Date.now()}.${ext}`;
          finalImageUrl = await uploadToStorage(imageFile, path);

          // Delete old image if editing and had one
          if (editingSeal?.image_url) {
            await deleteFromStorage(editingSeal.image_url);
          }
        } finally {
          setUploading(false);
        }
      }

      if (editingSeal) {
        const { error } = await supabase
          .from("seals")
          .update({ name: name.trim(), icon: icon.trim() || "⭐", image_url: finalImageUrl })
          .eq("id", editingSeal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("seals")
          .insert({ name: name.trim(), icon: icon.trim() || "⭐", image_url: finalImageUrl });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingSeal ? "Selo atualizado!" : "Selo criado!");
      queryClient.invalidateQueries({ queryKey: ["all-seals"] });
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar selo."),
  });

  const deleteSeal = useMutation({
    mutationFn: async (id: string) => {
      const seal = seals?.find((s) => s.id === id);
      if (seal?.image_url) {
        await deleteFromStorage(seal.image_url);
      }
      await supabase.from("professional_seals").delete().eq("seal_id", id);
      const { error } = await supabase.from("seals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Selo deletado!");
      queryClient.invalidateQueries({ queryKey: ["all-seals"] });
      setDeleteConfirmId(null);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao deletar selo."),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageUrl("");
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openCreate = () => {
    setEditingSeal(null);
    setName("");
    setIcon("⭐");
    setImageUrl("");
    setImageFile(null);
    setImagePreview(null);
    setDialogOpen(true);
  };

  const openEdit = (seal: any) => {
    setEditingSeal(seal);
    setName(seal.name);
    setIcon(seal.icon);
    setImageUrl(seal.image_url || "");
    setImageFile(null);
    setImagePreview(seal.image_url || null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingSeal(null);
    setImageFile(null);
    setImagePreview(null);
  };

  const isSaving = saveSeal.isPending || uploading;

  return (
    <div className="bg-card rounded-2xl shadow-card p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <Award className="h-5 w-5" />
            Gerenciar Selos
          </h2>
          <p className="text-sm text-muted-foreground">Crie, edite ou exclua selos disponíveis.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Novo Selo
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !seals?.length ? (
        <p className="text-sm text-muted-foreground">Nenhum selo cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {seals.map((seal) => (
            <div key={seal.id} className="flex items-center justify-between border border-border rounded-lg p-3">
              <div className="flex items-center gap-3">
                {seal.image_url ? (
                  <img src={seal.image_url} alt={seal.name} className="w-8 h-8 object-contain" />
                ) : (
                  <span className="text-2xl">{seal.icon}</span>
                )}
                <span className="text-sm font-medium text-foreground">{seal.name}</span>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(seal)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteConfirmId(seal.id)}
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingSeal ? "Editar Selo" : "Novo Selo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Especialista Elite" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Ícone (emoji)</label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="⭐" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Imagem do Selo (opcional)</label>
              
              {imagePreview ? (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Preview" className="w-16 h-16 object-contain rounded-lg border border-border" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors w-full"
                >
                  <Upload className="h-4 w-4" />
                  Clique para enviar uma imagem
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveSeal.mutate()} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(v) => { if (!v) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Deletar Selo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza? Este selo será removido de todos os profissionais que o possuem.
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteSeal.mutate(deleteConfirmId)}
              disabled={deleteSeal.isPending}
            >
              {deleteSeal.isPending ? "Deletando..." : "Deletar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSealManager;
