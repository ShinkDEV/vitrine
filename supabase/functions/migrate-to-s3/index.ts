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

async function putObjectToS3(
  bucketName: string,
  objectKey: string,
  body: Uint8Array,
  contentType: string,
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

  const payloadHash = await sha256Hex(body.buffer as ArrayBuffer);

  const headersToSign: [string, string][] = [
    ["content-type", contentType],
    ["host", host],
    ["x-amz-content-sha256", payloadHash],
    ["x-amz-date", amzDate],
  ];

  const signedHeadersStr = headersToSign.map(([k]) => k).join(";");
  const canonicalHeadersStr = headersToSign.map(([k, v]) => `${k}:${v}\n`).join("");

  const canonicalRequest = [
    "PUT",
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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID")!;
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
    const publicUrl = Deno.env.get("AWS_S3_PUBLIC_URL")!.replace(/\/$/, "");
    const bucketName = "vitrine-especialistas";
    const region = "sa-east-1";

    const OLD_R2_BASE = "https://pub-6984ca83f5ba41c08c7a8b1a1a2870f5.r2.dev";

    const results: { table: string; id: string; oldUrl: string; newUrl: string; status: string }[] = [];

    const migrateUrl = async (oldUrl: string): Promise<string | null> => {
      // Strip query params (cache busters)
      const cleanUrl = oldUrl.split("?")[0];
      if (!cleanUrl.startsWith(OLD_R2_BASE)) return null;

      const path = cleanUrl.replace(OLD_R2_BASE + "/", "");

      // Download from R2
      const downloadRes = await fetch(cleanUrl);
      if (!downloadRes.ok) {
        console.error(`Failed to download ${cleanUrl}: ${downloadRes.status}`);
        return null;
      }

      const bytes = new Uint8Array(await downloadRes.arrayBuffer());
      const contentType = downloadRes.headers.get("content-type") || "application/octet-stream";

      // Upload to S3
      const s3Res = await putObjectToS3(bucketName, path, bytes, contentType, accessKeyId, secretAccessKey, region);
      if (!s3Res.ok) {
        const errText = await s3Res.text();
        console.error(`S3 upload failed for ${path}: ${s3Res.status} ${errText}`);
        return null;
      }
      await s3Res.text();

      return `${publicUrl}/${path}`;
    };

    // 1. Migrate profile photos
    const { data: professionals } = await supabase
      .from("professionals")
      .select("id, profile_photo_url")
      .not("profile_photo_url", "is", null);

    for (const p of professionals || []) {
      const baseUrl = p.profile_photo_url.split("?")[0];
      if (!baseUrl.startsWith(OLD_R2_BASE)) continue;

      const newUrl = await migrateUrl(p.profile_photo_url);
      if (newUrl) {
        const cacheBust = `${newUrl}?t=${Date.now()}`;
        await supabase.from("professionals").update({ profile_photo_url: cacheBust }).eq("id", p.id);
        results.push({ table: "professionals", id: p.id, oldUrl: p.profile_photo_url, newUrl: cacheBust, status: "ok" });
      } else {
        results.push({ table: "professionals", id: p.id, oldUrl: p.profile_photo_url, newUrl: "", status: "failed" });
      }
    }

    // 2. Migrate portfolio photos
    const { data: portfolios } = await supabase
      .from("portfolio_photos")
      .select("id, photo_url");

    for (const ph of portfolios || []) {
      if (!ph.photo_url.startsWith(OLD_R2_BASE)) continue;

      const newUrl = await migrateUrl(ph.photo_url);
      if (newUrl) {
        await supabase.from("portfolio_photos").update({ photo_url: newUrl }).eq("id", ph.id);
        results.push({ table: "portfolio_photos", id: ph.id, oldUrl: ph.photo_url, newUrl, status: "ok" });
      } else {
        results.push({ table: "portfolio_photos", id: ph.id, oldUrl: ph.photo_url, newUrl: "", status: "failed" });
      }
    }

    // 3. Migrate certificates
    const { data: certs } = await supabase
      .from("professional_certificates")
      .select("id, file_url");

    for (const c of certs || []) {
      if (!c.file_url.startsWith(OLD_R2_BASE)) continue;

      const newUrl = await migrateUrl(c.file_url);
      if (newUrl) {
        await supabase.from("professional_certificates").update({ file_url: newUrl }).eq("id", c.id);
        results.push({ table: "professional_certificates", id: c.id, oldUrl: c.file_url, newUrl, status: "ok" });
      } else {
        results.push({ table: "professional_certificates", id: c.id, oldUrl: c.file_url, newUrl: "", status: "failed" });
      }
    }

    // 4. Migrate banners
    const { data: banners } = await supabase
      .from("banners")
      .select("id, image_url");

    for (const b of banners || []) {
      if (!b.image_url.startsWith(OLD_R2_BASE)) continue;

      const newUrl = await migrateUrl(b.image_url);
      if (newUrl) {
        await supabase.from("banners").update({ image_url: newUrl }).eq("id", b.id);
        results.push({ table: "banners", id: b.id, oldUrl: b.image_url, newUrl, status: "ok" });
      } else {
        results.push({ table: "banners", id: b.id, oldUrl: b.image_url, newUrl: "", status: "failed" });
      }
    }

    const ok = results.filter(r => r.status === "ok").length;
    const failed = results.filter(r => r.status === "failed").length;

    console.log(`Migration complete: ${ok} ok, ${failed} failed`);

    return new Response(
      JSON.stringify({ message: `Migrated ${ok} files, ${failed} failed`, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Migration error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
