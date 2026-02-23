import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const encoder = new TextEncoder();

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", data));
}

async function getSignatureKey(secret: string, dateStamp: string, region: string, service: string) {
  let key = await hmacSha256(encoder.encode("AWS4" + secret), dateStamp);
  key = await hmacSha256(key, region);
  key = await hmacSha256(key, service);
  return hmacSha256(key, "aws4_request");
}

async function putObjectToR2(
  accountId: string,
  bucketName: string,
  objectKey: string,
  body: Uint8Array,
  contentType: string,
  accessKeyId: string,
  secretAccessKey: string,
) {
  const region = "auto";
  const service = "s3";
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const url = `https://${host}/${bucketName}/${objectKey}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256Hex(body.buffer as ArrayBuffer);

  // Headers to sign (lowercase, sorted)
  const headersToSign: [string, string][] = [
    ["content-type", contentType],
    ["host", host],
    ["x-amz-content-sha256", payloadHash],
    ["x-amz-date", amzDate],
  ];

  const signedHeadersStr = headersToSign.map(([k]) => k).join(";");
  const canonicalHeadersStr = headersToSign.map(([k, v]) => `${k}:${v}\n`).join("");

  const canonicalUri = `/${bucketName}/${objectKey}`;
  const canonicalQueryString = "";

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQueryString,
    canonicalHeadersStr,
    signedHeadersStr,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(encoder.encode(canonicalRequest)),
  ].join("\n");

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      Host: host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorizationHeader,
    },
    body: body,
  });

  return response;
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
      console.error("Missing R2 env vars:", { accountId: !!accountId, accessKeyId: !!accessKeyId, secretAccessKey: !!secretAccessKey, bucketName: !!bucketName, publicUrl: !!publicUrl });
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
    const contentType = file.type || "application/octet-stream";

    console.log(`Uploading ${filePath} (${fileBytes.length} bytes, ${contentType}) to R2 bucket ${bucketName}`);

    const r2Response = await putObjectToR2(
      accountId, bucketName, filePath, fileBytes, contentType, accessKeyId, secretAccessKey
    );

    if (!r2Response.ok) {
      const errorText = await r2Response.text();
      console.error(`R2 upload error [${r2Response.status}]:`, errorText);
      return new Response(
        JSON.stringify({ error: `R2 upload failed: ${r2Response.status}`, details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Consume response body
    await r2Response.text();

    const cleanPublicUrl = publicUrl.replace(/\/$/, "");
    const filePublicUrl = `${cleanPublicUrl}/${filePath}`;

    console.log(`Upload success: ${filePublicUrl}`);

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
