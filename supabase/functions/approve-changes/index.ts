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
    // Auth: verify the caller is admin/colaborador
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check role
    const { data: roles } = await anonClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "colaborador"]);

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { professional_id } = await req.json();
    if (!professional_id) {
      return new Response(JSON.stringify({ error: "Missing professional_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for write operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get pending changes
    const { data: pending, error: pcError } = await supabase
      .from("pending_changes")
      .select("data")
      .eq("professional_id", professional_id)
      .maybeSingle();

    if (pcError || !pending) {
      return new Response(JSON.stringify({ error: "No pending changes found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = pending.data as any;

    // 1. Update professional profile
    if (data.profile) {
      const { error } = await supabase
        .from("professionals")
        .update({
          ...data.profile,
          last_portfolio_update: new Date().toISOString(),
          status: "publicado",
        })
        .eq("id", professional_id);
      if (error) throw new Error(`Profile update: ${error.message}`);
    }

    // 2. Replace services
    if (data.services) {
      await supabase.from("services").delete().eq("professional_id", professional_id);
      if (data.services.length > 0) {
        const { error } = await supabase.from("services").insert(
          data.services.map((s: any) => ({ ...s, professional_id }))
        );
        if (error) throw new Error(`Services: ${error.message}`);
      }
    }

    // 3. Replace working hours
    if (data.working_hours) {
      await supabase.from("working_hours").delete().eq("professional_id", professional_id);
      if (data.working_hours.length > 0) {
        const { error } = await supabase.from("working_hours").insert(
          data.working_hours.map((h: any) => ({ ...h, professional_id }))
        );
        if (error) throw new Error(`Working hours: ${error.message}`);
      }
    }

    // 4. Delete pending changes
    await supabase.from("pending_changes").delete().eq("professional_id", professional_id);

    console.log(`Approved pending changes for ${professional_id}`);

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Approve error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
