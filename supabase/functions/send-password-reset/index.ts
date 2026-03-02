import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, redirectUrl } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing environment variables" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate password reset link
    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: redirectUrl || `${SUPABASE_URL.replace('.supabase.co', '')}/redefinir-senha`,
        },
      });

    if (linkError) {
      // Don't reveal if user exists or not
      console.error("Link generation error:", linkError);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetLink = linkData?.properties?.action_link;
    if (!resetLink) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin:0;padding:0;background-color:#ffffff;font-family:'DM Sans',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
          <tr>
            <td align="center" style="padding:40px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <h1 style="margin:0;font-size:22px;color:hsl(330,49%,49%);font-weight:700;">
                      ✨ Vitrine dos Especialistas da Beleza
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="background-color:#fff;border-radius:16px;border:1px solid hsl(326,35%,88%);padding:32px;">
                    <h2 style="margin:0 0 8px;font-size:18px;color:hsl(0,0%,12%);">Redefinição de senha</h2>
                    <p style="margin:0 0 24px;font-size:14px;color:hsl(0,0%,40%);line-height:1.6;">
                      Você solicitou a redefinição da sua senha. Clique no botão abaixo para criar uma nova senha. Este link é válido por 1 hora.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,hsl(330,49%,49%),hsl(327,64%,36%));color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:9999px;">
                            Redefinir minha senha
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:24px 0 0;font-size:12px;color:hsl(0,0%,40%);line-height:1.5;">
                      Se você não solicitou essa redefinição, ignore este email. Sua conta permanece segura.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:24px;">
                    <p style="margin:0;font-size:12px;color:hsl(0,0%,60%);">
                      © ${new Date().getFullYear()} Vitrine dos Especialistas da Beleza
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "avisos@vitrine.escola.ro",
        to: [email],
        subject: "Redefina sua senha — Vitrine dos Especialistas da Beleza",
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Resend error:", data);
    }

    // Always return success to not reveal if email exists
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
