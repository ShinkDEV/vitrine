import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  return crypto.subtle
    .importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((k) => crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)));
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string) {
  let kDate = await hmacSha256(new TextEncoder().encode("AWS4" + key), dateStamp);
  let kRegion = await hmacSha256(kDate, region);
  let kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

async function signRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: ArrayBuffer,
  accessKeyId: string,
  secretAccessKey: string,
  region: string
) {
  const u = new URL(url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);

  headers["x-amz-date"] = amzDate;
  headers["x-amz-content-sha256"] = toHex(await crypto.subtle.digest("SHA-256", body));

  const signedHeaderKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();
  const signedHeaders = signedHeaderKeys.join(";");
  const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headers[k.split("").reduce((a, c) => a, "") ? k : Object.keys(headers).find((h) => h.toLowerCase() === k)!]}\n`).join("");

  // Rebuild canonical headers properly
  const sortedEntries = Object.entries(headers)
    .map(([k, v]) => [k.toLowerCase(), v] as [string, string])
    .sort(([a], [b]) => a.localeCompare(b));

  const canonicalHeadersStr = sortedEntries.map(([k, v]) => `${k}:${v}\n`).join("");
  const signedHeadersStr = sortedEntries.map(([k]) => k).join(";");

  const canonicalRequest = [
    method,
    u.pathname,
    u.search.slice(1),
    canonicalHeadersStr,
    signedHeadersStr,
    headers["x-amz-content-sha256"],
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalRequest))),
  ].join("\n");

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, "s3");
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  headers["Authorization"] = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;
  return headers;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get R2 credentials
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
    const accessKeyId = Deno.env.get("CLOUDFLARE_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("CLOUDFLARE_SECRET_ACCESS_KEY");
    const bucketName = Deno.env.get("CLOUDFLARE_R2_BUCKET_NAME");
    const publicUrl = Deno.env.get("CLOUDFLARE_R2_PUBLIC_URL");

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
      return new Response(JSON.stringify({ error: "Missing R2 configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const filePath = formData.get("path") as string;

    if (!file || !filePath) {
      return new Response(JSON.stringify({ error: "Missing file or path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const uploadUrl = `${r2Endpoint}/${bucketName}/${filePath}`;

    const reqHeaders: Record<string, string> = {
      Host: `${accountId}.r2.cloudflarestorage.com`,
      "Content-Type": file.type || "application/octet-stream",
    };

    const signedHeaders = await signRequest(
      "PUT",
      uploadUrl,
      reqHeaders,
      fileBytes.buffer as ArrayBuffer,
      accessKeyId,
      secretAccessKey,
      "auto"
    );

    const r2Response = await fetch(uploadUrl, {
      method: "PUT",
      headers: signedHeaders,
      body: fileBytes,
    });

    if (!r2Response.ok) {
      const errorText = await r2Response.text();
      console.error(`R2 upload error [${r2Response.status}]:`, errorText);
      return new Response(
        JSON.stringify({ error: `R2 upload failed: ${r2Response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construct public URL
    const cleanPublicUrl = publicUrl.replace(/\/$/, "");
    const filePublicUrl = `${cleanPublicUrl}/${filePath}`;

    return new Response(
      JSON.stringify({ url: filePublicUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
