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

    // Find professionals with last_portfolio_update older than 5 months (warning) or 6 months (expired)
    const fiveMonthsAgo = new Date();
    fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);

    const { data: professionals, error } = await supabase
      .from("professionals")
      .select("id, name, user_id, last_portfolio_update, status")
      .eq("status", "publicado")
      .lt("last_portfolio_update", fiveMonthsAgo.toISOString());

    if (error) throw error;

    if (!professionals || professionals.length === 0) {
      return new Response(JSON.stringify({ message: "No reminders to send", count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    for (const prof of professionals) {
      // Get email from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", prof.user_id)
        .maybeSingle();

      if (!profile?.email) continue;

      const isExpired = new Date(prof.last_portfolio_update) <= sixMonthsAgo;

      const subject = isExpired
        ? "⚠️ Seu perfil será desativado — Atualize seu portfólio agora"
        : "📸 Lembrete: Atualize seu portfólio em breve";

      const html = emailWrapper(
        isExpired
          ? `
            <h1 style="margin:0 0 16px;color:#dc2626;font-size:24px;font-weight:700;">
              Atenção, ${prof.name}! ⚠️
            </h1>
            <p style="color:#374151;font-size:16px;line-height:1.7;margin:0 0 12px;">
              Faz mais de <strong>6 meses</strong> desde a última atualização do seu perfil na <strong style="color:#b8396b;">Vitrine dos Especialistas da Beleza</strong>.
            </p>
            <p style="color:#374151;font-size:16px;line-height:1.7;margin:0 0 12px;">
              Para manter seu perfil ativo e visível para clientes, atualize seu portfólio o mais rápido possível.
            </p>
            ${brandButton("Atualizar meu portfólio", "https://kind-logic.lovable.app/editar-perfil")}
          `
          : `
            <h1 style="margin:0 0 16px;color:#8b2560;font-size:24px;font-weight:700;">
              Olá, ${prof.name}! 📸
            </h1>
            <p style="color:#374151;font-size:16px;line-height:1.7;margin:0 0 12px;">
              Sua última atualização de portfólio na <strong style="color:#b8396b;">Vitrine dos Especialistas da Beleza</strong> foi há quase 6 meses.
            </p>
            <p style="color:#374151;font-size:16px;line-height:1.7;margin:0 0 12px;">
              Mantenha seu perfil atualizado para continuar sendo encontrado(a) por clientes! Adicione novas fotos e atualize seus serviços.
            </p>
            ${brandButton("Atualizar meu portfólio", "https://kind-logic.lovable.app/editar-perfil")}
          `
      );

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Vitrine dos Especialistas da Beleza <avisos@escola.ro>",
          to: [profile.email],
          subject,
          html,
        }),
      });

      if (res.ok) sentCount++;
      else console.error(`Failed to send to ${profile.email}:`, await res.text());
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount, total: professionals.length }), {
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
