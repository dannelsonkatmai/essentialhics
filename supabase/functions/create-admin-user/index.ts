import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create the auth user via admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: "admin@demo.hics",
      password: "Admin1234!",
      email_confirm: true,
      user_metadata: { first_name: "System", last_name: "Admin" },
    });

    if (authError && !authError.message.includes("already been registered")) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData?.user?.id ?? null;

    // Upsert the app_users record with whatever ID was assigned
    if (userId) {
      await supabaseAdmin.from("app_users").upsert({
        id: userId,
        health_system_id: "00000000-0000-0000-0000-000000000001",
        email: "admin@demo.hics",
        first_name: "System",
        last_name: "Admin",
        display_name: "System Admin",
        job_title: "HICS Administrator",
        auth_provider: "LOCAL",
        is_active: true,
        must_change_password: false,
        mfa_enabled: false,
      }, { onConflict: "id" });

      // Assign SYSTEM_ADMIN role
      await supabaseAdmin.from("user_facility_roles").upsert({
        user_id: userId,
        facility_id: "00000000-0000-0000-0000-000000000002",
        hics_role: "SYSTEM_ADMIN",
        is_primary_facility: true,
      }, { onConflict: "user_id,facility_id,hics_role" });

      // Assign FACILITY_ADMIN role
      await supabaseAdmin.from("user_facility_roles").upsert({
        user_id: userId,
        facility_id: "00000000-0000-0000-0000-000000000002",
        hics_role: "FACILITY_ADMIN",
        is_primary_facility: false,
      }, { onConflict: "user_id,facility_id,hics_role" });
    }

    return new Response(
      JSON.stringify({ success: true, userId, message: "Admin user created successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
