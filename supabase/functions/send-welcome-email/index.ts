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
    const { name, email } = await req.json();

    if (!name || !email) {
      return new Response(JSON.stringify({ error: "name and email are required" }), {
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
        to: [email],
        subject: "Bem-vindo(a) à Vitrine dos Especialistas da Beleza!",
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #fdf8f4; border-radius: 16px;">
            <h1 style="color: #7c3aed; font-size: 24px; margin-bottom: 16px;">Olá, ${name}! 🎉</h1>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Sua conta na <strong>Vitrine dos Especialistas da Beleza</strong> foi criada com sucesso!
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Agora você pode completar seu perfil, adicionar seus serviços e fotos do portfólio para ser encontrado(a) por clientes da sua região.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="https://kind-logic.lovable.app/login" style="background: linear-gradient(135deg, #7c3aed, #a855f7); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Acessar minha conta
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              Se precisar de ajuda, entre em contato conosco respondendo este e-mail.
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
