import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Não autorizado", status: 401 };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: callerClaims, error: claimsError } = await callerClient.auth.getUser();
  if (claimsError || !callerClaims.user) {
    return { error: "Não autorizado", status: 401 };
  }

  const { data: roles } = await callerClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerClaims.user.id)
    .eq("role", "admin");

  if (!roles || roles.length === 0) {
    return { error: "Apenas admins podem realizar esta ação", status: 403 };
  }

  return { userId: callerClaims.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminCheck = await verifyAdmin(req);
    if ("error" in adminCheck) {
      return new Response(JSON.stringify({ error: adminCheck.error }), {
        status: adminCheck.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Reset password action
    if (action === "reset_password") {
      const { user_id, new_password } = body;
      if (!user_id || !new_password || new_password.length < 6) {
        return new Response(
          JSON.stringify({ error: "ID do usuário e nova senha (mín. 6 caracteres) são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await adminClient.auth.admin.updateUserById(user_id, {
        password: new_password,
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: create collaborator
    const { email, password, name, permissions } = body;

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: "Email, senha e nome são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, is_collaborator: "true" },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // Remove auto-created professional profile and role from trigger
    await adminClient.from("professionals").delete().eq("user_id", userId);
    await adminClient.from("user_roles").delete().eq("user_id", userId).eq("role", "professional");

    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({ user_id: userId, role: "colaborador" });
    if (roleError) console.error("Role assignment error:", roleError);

    const { error: permError } = await adminClient
      .from("collaborator_permissions")
      .insert({
        user_id: userId,
        can_approve_profiles: permissions?.can_approve_profiles ?? false,
        can_manage_seals: permissions?.can_manage_seals ?? false,
        can_manage_invites: permissions?.can_manage_invites ?? false,
      });
    if (permError) console.error("Permission creation error:", permError);

    return new Response(
      JSON.stringify({ success: true, user: { id: userId, email, name } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
