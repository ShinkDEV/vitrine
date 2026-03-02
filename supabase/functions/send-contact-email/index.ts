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
              Responda diretamente a este e-mail para entrar em contato.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { professionalEmail, professionalName, senderName, senderEmail, message } = await req.json();

    if (!professionalEmail || !professionalName || !senderName || !senderEmail || !message) {
      return new Response(JSON.stringify({ error: "All fields are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const escapedMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const html = emailWrapper(`
      <h1 style="margin:0 0 16px;color:#8b2560;font-size:24px;font-weight:700;">
        Nova mensagem recebida 💌
      </h1>
      <p style="color:#374151;font-size:16px;line-height:1.7;margin:0 0 20px;">
        Olá, <strong style="color:#b8396b;">${professionalName}</strong>! Você recebeu uma nova mensagem pela Vitrine.
      </p>
      <div style="background:#fdf0f5;border-radius:12px;padding:20px 24px;border-left:4px solid #b8396b;margin:0 0 24px;">
        <p style="margin:0 0 8px;color:#a3738e;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
          De: ${senderName}
        </p>
        <p style="margin:0 0 4px;color:#a3738e;font-size:13px;">
          ${senderEmail}
        </p>
        <hr style="border:none;border-top:1px solid #f0d4e2;margin:12px 0;" />
        <p style="color:#374151;font-size:16px;line-height:1.7;margin:0;white-space:pre-wrap;">${escapedMessage}</p>
      </div>
      <p style="color:#a3738e;font-size:14px;line-height:1.5;margin:0;">
        Responda diretamente a este e-mail para entrar em contato com <strong>${senderName}</strong>.
      </p>
    `);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Vitrine dos Especialistas da Beleza <avisos@escola.ro>",
        to: [professionalEmail],
        reply_to: senderEmail,
        subject: `Nova mensagem de ${senderName} via Vitrine ✨`,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend error:", data);
      return new Response(JSON.stringify({ error: "Failed to send email", details: data }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
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
