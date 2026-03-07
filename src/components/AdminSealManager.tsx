import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Award, Plus, Pencil, Trash2 } from "lucide-react";

const AdminSealManager = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeal, setEditingSeal] = useState<any>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("⭐");
  const [imageUrl, setImageUrl] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
      if (editingSeal) {
        const { error } = await supabase
          .from("seals")
          .update({ name: name.trim(), icon: icon.trim() || "⭐", image_url: imageUrl.trim() || null })
          .eq("id", editingSeal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("seals")
          .insert({ name: name.trim(), icon: icon.trim() || "⭐", image_url: imageUrl.trim() || null });
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
      // Delete assigned seals first
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

  const openCreate = () => {
    setEditingSeal(null);
    setName("");
    setIcon("⭐");
    setImageUrl("");
    setDialogOpen(true);
  };

  const openEdit = (seal: any) => {
    setEditingSeal(seal);
    setName(seal.name);
    setIcon(seal.icon);
    setImageUrl(seal.image_url || "");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingSeal(null);
  };

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
              <label className="text-sm font-medium text-foreground mb-1 block">URL da Imagem (opcional)</label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveSeal.mutate()} disabled={saveSeal.isPending}>
              {saveSeal.isPending ? "Salvando..." : "Salvar"}
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
