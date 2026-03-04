import { supabase } from "@/integrations/supabase/client";

/**
 * Upload a file to S3 via the edge function and return its public URL.
 */
export async function uploadToStorage(
  file: File | Blob,
  path: string,
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const formData = new FormData();
  formData.append("file", file instanceof File ? file : new File([file], "upload.jpg", { type: "image/jpeg" }));
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
}
