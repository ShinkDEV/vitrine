import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { professional_id, reason, block, block_email, block_cpf } = await req.json();

    if (!professional_id || !reason) {
      return new Response(JSON.stringify({ error: "ID e motivo são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get professional data
    const { data: pro, error: proErr } = await supabaseAdmin
      .from("professionals")
      .select("user_id, name, cpf")
      .eq("id", professional_id)
      .single();

    if (proErr || !pro) {
      return new Response(JSON.stringify({ error: "Profissional não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get email
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", pro.user_id)
      .maybeSingle();

    // If blocking, add to blocked_users
    if (block) {
      await supabaseAdmin.from("blocked_users").insert({
        email: block_email || profile?.email || null,
        cpf: block_cpf || pro.cpf || null,
        reason,
        blocked_by: user.id,
        professional_name: pro.name,
      });
    }

    // Delete related data (cascade should handle most, but let's be thorough)
    await supabaseAdmin.from("portfolio_photos").delete().eq("professional_id", professional_id);
    await supabaseAdmin.from("services").delete().eq("professional_id", professional_id);
    await supabaseAdmin.from("working_hours").delete().eq("professional_id", professional_id);
    await supabaseAdmin.from("professional_courses").delete().eq("professional_id", professional_id);
    await supabaseAdmin.from("professional_certificates").delete().eq("professional_id", professional_id);
    await supabaseAdmin.from("professional_seals").delete().eq("professional_id", professional_id);
    await supabaseAdmin.from("pending_changes").delete().eq("professional_id", professional_id);
    await supabaseAdmin.from("professionals").delete().eq("id", professional_id);

    // Delete user roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", pro.user_id);

    // Delete profile
    await supabaseAdmin.from("profiles").delete().eq("user_id", pro.user_id);

    // Delete auth user
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(pro.user_id);
    if (deleteErr) {
      console.error("Error deleting auth user:", deleteErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
