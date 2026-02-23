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

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "avisos@vitrine.escola.ro",
        to: [professionalEmail],
        reply_to: senderEmail,
        subject: `Nova mensagem de ${senderName} via Vitrine`,
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #fdf8f4; border-radius: 16px;">
            <h1 style="color: #7c3aed; font-size: 24px; margin-bottom: 16px;">Nova mensagem recebida 💌</h1>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Olá, <strong>${professionalName}</strong>! Você recebeu uma nova mensagem pela Vitrine dos Especialistas da Beleza.
            </p>
            <div style="background: white; border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid #7c3aed;">
              <p style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">
                <strong>De:</strong> ${senderName} (${senderEmail})
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              Responda diretamente a este e-mail para entrar em contato com ${senderName}.
            </p>
          </div>
        `,
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
