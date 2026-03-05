import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#fdf6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fdf6f9;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px -4px rgba(180,60,120,0.1);">
        <tr>
          <td style="background:linear-gradient(135deg,#b8396b,#8b2560);padding:32px 40px;text-align:center;">
            <h2 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">
              ✨ Vitrine dos Especialistas da Beleza
            </h2>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="background-color:#fdf0f5;padding:24px 40px;text-align:center;border-top:1px solid #f0d4e2;">
            <p style="margin:0;color:#a3738e;font-size:13px;line-height:1.5;">
              Vitrine dos Especialistas da Beleza<br/>
              Este e-mail foi enviado automaticamente. Não responda a esta mensagem.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

const brandButton = (text: string, url: string) =>
  `<div style="text-align:center;margin:32px 0;">
    <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#b8396b,#8b2560);color:#ffffff;padding:14px 36px;border-radius:12px;text-decoration:none;font-weight:600;font-size:16px;box-shadow:0 4px 14px -4px rgba(180,60,120,0.35);">
      ${text}
    </a>
  </div>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { professional_id, reason } = await req.json();

    if (!professional_id || !reason) {
      return new Response(JSON.stringify({ error: "Missing professional_id or reason" }), {
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get professional data
    const { data: prof, error: profError } = await supabase
      .from("professionals")
      .select("name, user_id")
      .eq("id", professional_id)
      .single();

    if (profError || !prof) {
      return new Response(JSON.stringify({ error: "Professional not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", prof.user_id)
      .maybeSingle();

    if (!profile?.email) {
      return new Response(JSON.stringify({ error: "Email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = emailWrapper(`
      <h1 style="margin:0 0 16px;color:#dc2626;font-size:24px;font-weight:700;">
        Seu cadastro foi rejeitado ⚠️
      </h1>
      <p style="color:#374151;font-size:16px;line-height:1.7;margin:0 0 12px;">
        Olá, <strong>${prof.name}</strong>.
      </p>
      <p style="color:#374151;font-size:16px;line-height:1.7;margin:0 0 12px;">
        Seu perfil na <strong style="color:#b8396b;">Vitrine dos Especialistas da Beleza</strong> foi revisado e infelizmente <strong style="color:#dc2626;">não foi aprovado</strong>.
      </p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin:20px 0;">
        <p style="color:#991b1b;font-size:14px;font-weight:600;margin:0 0 8px;">📋 Motivo da rejeição:</p>
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0;">${reason}</p>
      </div>
      <p style="color:#374151;font-size:16px;line-height:1.7;margin:0 0 12px;">
        Corrija os pontos indicados e envie novamente para aprovação.
      </p>
      ${brandButton("Corrigir meu perfil", "https://kind-logic.lovable.app/editar-perfil")}
      <p style="color:#a3738e;font-size:14px;line-height:1.5;margin:0;">
        Se tiver dúvidas, entre em contato conosco.
      </p>
    `);

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Vitrine dos Especialistas da Beleza <avisos@escola.ro>",
        to: [profile.email],
        subject: "⚠️ Seu cadastro foi rejeitado — Veja o motivo e corrija",
        html,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Resend error:", errText);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
