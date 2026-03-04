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

async function deleteObjectFromS3(
  bucketName: string,
  objectKey: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
) {
  const service = "s3";
  const host = `${bucketName}.s3.${region}.amazonaws.com`;
  const url = `https://${host}/${objectKey}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256Hex(new Uint8Array(0));

  const headersToSign: [string, string][] = [
    ["host", host],
    ["x-amz-content-sha256", payloadHash],
    ["x-amz-date", amzDate],
  ];

  const signedHeadersStr = headersToSign.map(([k]) => k).join(";");
  const canonicalHeadersStr = headersToSign.map(([k, v]) => `${k}:${v}\n`).join("");

  const canonicalRequest = [
    "DELETE",
    `/${objectKey}`,
    "",
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

  return fetch(url, {
    method: "DELETE",
    headers: {
      Host: host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorizationHeader,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url: fileUrl } = await req.json();
    if (!fileUrl) {
      return new Response(JSON.stringify({ error: "Missing url" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID")!;
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
    const publicUrl = Deno.env.get("AWS_S3_PUBLIC_URL")!.replace(/\/$/, "");
    const bucketName = "vitrine-especialistas";
    const region = "sa-east-1";

    // Extract object key from the URL
    const cleanUrl = fileUrl.split("?")[0];
    let objectKey = "";

    if (cleanUrl.startsWith(publicUrl)) {
      objectKey = cleanUrl.replace(publicUrl + "/", "");
    } else if (cleanUrl.includes(".amazonaws.com/")) {
      objectKey = cleanUrl.split(".amazonaws.com/")[1];
    } else if (cleanUrl.includes(".r2.dev/")) {
      // Old R2 URLs - extract path
      objectKey = cleanUrl.split(".r2.dev/")[1];
    }

    if (!objectKey) {
      console.log("Could not extract object key from URL:", fileUrl);
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Deleting ${objectKey} from S3 bucket ${bucketName}`);

    const s3Res = await deleteObjectFromS3(bucketName, objectKey, accessKeyId, secretAccessKey, region);

    // S3 returns 204 on successful delete
    if (!s3Res.ok && s3Res.status !== 204) {
      const errText = await s3Res.text();
      console.error(`S3 delete error [${s3Res.status}]:`, errText);
    } else {
      await s3Res.text();
    }

    console.log(`Delete complete: ${objectKey}`);

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Delete error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
