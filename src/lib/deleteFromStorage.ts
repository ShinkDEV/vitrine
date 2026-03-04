import { supabase } from "@/integrations/supabase/client";

/**
 * Delete a file from S3 via the edge function.
 * Silently fails - deletion is best-effort to not block user actions.
 */
export async function deleteFromStorage(fileUrl: string): Promise<void> {
  if (!fileUrl) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    await fetch(
      `https://${projectId}.supabase.co/functions/v1/delete-from-s3`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: fileUrl }),
      }
    );
  } catch (err) {
    console.error("Failed to delete file from S3:", err);
  }
}
