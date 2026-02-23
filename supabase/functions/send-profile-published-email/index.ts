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
    const { name, email, slug } = await req.json();

    if (!name || !email || !slug) {
      return new Response(JSON.stringify({ error: "name, email and slug are required" }), {
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

    const profileUrl = `https://kind-logic.lovable.app/profissional/${slug}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "avisos@vitrine.escola.ro",
        to: [email],
        subject: "Seu perfil foi publicado! 🎉",
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #fdf8f4; border-radius: 16px;">
            <h1 style="color: #7c3aed; font-size: 24px; margin-bottom: 16px;">Parabéns, ${name}! 🎉</h1>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Seu perfil na <strong>Vitrine dos Especialistas da Beleza</strong> foi aprovado e já está publicado!
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              Clientes da sua região já podem encontrar você. Compartilhe seu perfil nas redes sociais para atrair ainda mais clientes.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${profileUrl}" style="background: linear-gradient(135deg, #7c3aed, #a855f7); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Ver meu perfil
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              Mantenha seu perfil atualizado para conquistar mais clientes!
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
