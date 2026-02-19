import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // 1. Validate caller JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 2. Check caller is an owner — check both profiles and user_roles tables
    // Use admin client to verify JWT via getUser (getClaims does not exist in supabase-js v2)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = userData.user.id;
    
    const { data: profileRole } = await adminClient
      .from("profiles")
      .select("role")
      .eq("user_id", callerId)
      .maybeSingle();

    const { data: userRoleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .maybeSingle();

    const callerRole: string | null = userRoleRow?.role ?? profileRole?.role ?? null;
    const isOwner = callerRole === "owner";
    const isDispatcher = callerRole === "dispatcher";

    // Both owners and dispatchers can manage users
    if (!isOwner && !isDispatcher) {
      return new Response(JSON.stringify({ error: "Forbidden: Only owners and dispatchers can manage users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Parse request body — parse once, destructure all fields
    const body = await req.json();
    const { email, full_name, role, action, password: providedPassword } = body;

    // Handle different actions
    if (action === "list") {
      // List all users with their roles and profiles
      const { data: roles } = await adminClient.from("user_roles").select("user_id, role");
      const { data: profiles } = await adminClient.from("profiles").select("user_id, full_name, avatar_url");
      const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();

      if (listError) {
        return new Response(JSON.stringify({ error: listError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rolesMap: Record<string, string> = {};
      roles?.forEach((r: any) => { rolesMap[r.user_id] = r.role; });

      const profilesMap: Record<string, any> = {};
      profiles?.forEach((p: any) => { profilesMap[p.user_id] = p; });

      const team = users.map((u: any) => ({
        id: u.id,
        email: u.email,
        full_name: profilesMap[u.id]?.full_name || u.user_metadata?.full_name || u.email,
        role: rolesMap[u.id] || null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      }));

      return new Response(JSON.stringify({ team }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "change_role") {
      const user_id = body.user_id || email;
      const new_role = body.new_role || role;
      if (!user_id || !new_role || !["owner", "dispatcher", "driver"].includes(new_role)) {
        return new Response(JSON.stringify({ error: "Invalid user_id or role" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Dispatchers cannot promote anyone to "owner" — only owners can grant owner role
      if (!isOwner && new_role === "owner") {
        return new Response(JSON.stringify({ error: "Forbidden: Only owners can promote users to owner" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await adminClient.from("user_roles").upsert({ user_id, role: new_role }, { onConflict: "user_id,role" });
      await adminClient.from("profiles").update({ role: new_role }).eq("user_id", user_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      const targetEmail = email;
      if (!targetEmail) {
        return new Response(JSON.stringify({ error: "email is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: resetData, error: resetError } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: targetEmail,
      });

      if (resetError) {
        return new Response(JSON.stringify({ error: resetError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          recovery_link: resetData?.properties?.action_link || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "remove") {
      const userId = email; // reuse email field as user_id
      if (!userId) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Don't allow removing yourself
      if (userId === callerId) {
        return new Response(JSON.stringify({ error: "Cannot remove yourself" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Dispatchers cannot remove owners
      if (!isOwner) {
        const { data: targetRoleRow } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();
        if (targetRoleRow?.role === "owner") {
          return new Response(JSON.stringify({ error: "Forbidden: Only owners can remove other owners" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Delete role, profile, and auth user
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      await adminClient.from("profiles").delete().eq("user_id", userId);
      await adminClient.auth.admin.deleteUser(userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default action: invite (create user)
    if (!email || !full_name || !role) {
      return new Response(JSON.stringify({ error: "email, full_name, and role are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["owner", "dispatcher", "driver"].includes(role)) {
      return new Response(JSON.stringify({ error: "Role must be 'owner', 'dispatcher', or 'driver'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dispatchers cannot invite users with the owner role
    if (!isOwner && role === "owner") {
      return new Response(JSON.stringify({ error: "Forbidden: Only owners can invite other owners" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Create user via Admin API — use provided password or default
    const userPassword = providedPassword || "Anika2026!";
    
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Assign role in both tables for compatibility
    await adminClient.from("user_roles").upsert({ user_id: newUser.user.id, role }, { onConflict: "user_id,role" });
    await adminClient.from("profiles").upsert(
      { user_id: newUser.user.id, full_name, role },
      { onConflict: "user_id" }
    );

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUser.user.id,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          full_name,
          role,
        },
        temp_password: userPassword,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("invite-user error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
