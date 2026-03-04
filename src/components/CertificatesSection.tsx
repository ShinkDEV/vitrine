import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Trash2, FileText } from "lucide-react";

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 2048;

const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return resolve(file);
    if (file.size <= MAX_FILE_SIZE) return resolve(file);

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.8;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Falha na compressão"));
            if (blob.size <= MAX_FILE_SIZE || quality <= 0.3) {
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            } else {
              quality -= 0.1;
              tryCompress();
            }
          },
          "image/jpeg",
          quality
        );
      };
      tryCompress();
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Erro ao processar imagem")); };
    img.src = url;
  });
};

interface Props {
  professionalId?: string;
  userId?: string;
}

const CertificatesSection = ({ professionalId, userId }: Props) => {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: certificates } = useQuery({
    queryKey: ["my-certificates", professionalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_certificates")
        .select("*")
        .eq("professional_id", professionalId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!professionalId,
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !professionalId || !userId) return;
    e.target.value = "";

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Formato não aceito. Use JPG, PNG ou PDF.");
      return;
    }

    // Compress images that exceed 5MB
    let processedFile = file;
    if (file.type.startsWith("image/") && file.size > MAX_FILE_SIZE) {
      try {
        toast.info("Comprimindo imagem...");
        processedFile = await compressImage(file);
      } catch {
        toast.error("Erro ao comprimir imagem. Tente um arquivo menor.");
        return;
      }
    }

    if (processedFile.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 5MB.");
      return;
    }

    setUploading(true);
    try {
      const { uploadToStorage } = await import("@/lib/uploadToStorage");
      const ext = processedFile.name.split(".").pop();
      const path = `certificates/${userId}/${Date.now()}.${ext}`;

      const fileUrl = await uploadToStorage(processedFile, path);

      const { error: insertError } = await supabase
        .from("professional_certificates")
        .insert({
          professional_id: professionalId,
          file_name: file.name, // Keep original name
          file_url: fileUrl,
          file_type: processedFile.type,
        });
      if (insertError) throw insertError;

      toast.success("Certificado enviado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["my-certificates", professionalId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar certificado.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (cert: any) => {
    try {
      // Delete file from S3
      const { deleteFromStorage } = await import("@/lib/deleteFromStorage");
      await deleteFromStorage(cert.file_url);
      await supabase.from("professional_certificates").delete().eq("id", cert.id);
      toast.success("Certificado removido.");
      queryClient.invalidateQueries({ queryKey: ["my-certificates", professionalId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover.");
    }
  };

  const viewCertificate = (url: string) => {
    window.open(url, "_blank");
  };

  return (
    <div>
      <h3 className="text-base font-display font-semibold text-foreground mb-1">
        Certificados ({certificates?.length ?? 0}) *
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Envie seus certificados de formação. Formatos aceitos: JPG, PNG, PDF (máx. 5MB).
      </p>

      {certificates && certificates.length > 0 && (
        <div className="space-y-2 mb-3">
          {certificates.map((cert) => (
            <div key={cert.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <FileText className="h-5 w-5 text-primary flex-shrink-0" />
              <button
                type="button"
                onClick={() => viewCertificate(cert.file_url)}
                className="flex-1 text-sm text-foreground hover:text-primary truncate text-left transition-colors"
              >
                {cert.file_name}
              </button>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(cert.created_at).toLocaleDateString("pt-BR")}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(cert)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <label>
        <Button type="button" variant="outline" size="sm" asChild>
          <span>
            <Upload className="h-4 w-4 mr-1" />
            {uploading ? "Enviando..." : "Enviar certificado"}
          </span>
        </Button>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
      </label>
    </div>
  );
};

export default CertificatesSection;
