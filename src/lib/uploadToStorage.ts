import { supabase } from "@/integrations/supabase/client";

const BUCKET = "uploads";

/**
 * Upload a file to Lovable Cloud storage and return its public URL.
 */
export async function uploadToStorage(
  file: File | Blob,
  path: string,
  fileName?: string
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: file instanceof File ? file.type : "image/jpeg",
    });

  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return urlData.publicUrl;
}
