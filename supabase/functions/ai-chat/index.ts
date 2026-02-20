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
    // Auth check
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await sb.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    // Gather CRM context using user-scoped client (respects RLS)
    const [leadsRes, tasksRes, pipelineRes] = await Promise.all([
      sb.from("leads").select("id, company_name, contact_person, stage, city_hub, service_type, avg_packages_day, delivery_radius_miles, vehicle_type, sla_requirement, email, phone, estimated_monthly_loads, next_action_date, industry").limit(100),
      sb.from("tasks").select("id, title, status, priority, department, due_date, description").limit(100),
      sb.from("lead_interactions").select("id, note, activity_type, created_at, lead_id").order("created_at", { ascending: false }).limit(30),
    ]);

    const leads = leadsRes.data ?? [];
    const tasks = tasksRes.data ?? [];
    const interactions = pipelineRes.data ?? [];

    // Build stage summary
    const stageCounts: Record<string, number> = {};
    leads.forEach((l: any) => {
      stageCounts[l.stage] = (stageCounts[l.stage] || 0) + 1;
    });

    const today = new Date().toISOString().split("T")[0];
    const overdue = leads.filter((l: any) => l.next_action_date && l.next_action_date < today).length;
    const tasksDueToday = tasks.filter((t: any) => t.due_date === today && t.status !== "done").length;
    const openTasks = tasks.filter((t: any) => t.status !== "done").length;

    const systemPrompt = `You are Anika AI, the intelligent assistant for Anika Logistics CRM -- a last-mile delivery operations platform.

You have access to the following live CRM data:

## Pipeline Summary
Total leads: ${leads.length}
Overdue follow-ups: ${overdue}
Stage breakdown: ${JSON.stringify(stageCounts)}

## Tasks Summary
Open tasks: ${openTasks}
Tasks due today: ${tasksDueToday}

## Lead Details (top 100)
${JSON.stringify(leads, null, 1)}

## Task Details (open)
${JSON.stringify(tasks.filter((t: any) => t.status !== "done"), null, 1)}

## Recent Activity (last 30 interactions)
${JSON.stringify(interactions, null, 1)}

Instructions:
- Answer questions about leads, pipeline status, tasks, and operations using the data above.
- Be concise and actionable. Use bullet points and tables when helpful.
- If asked about a specific lead or company, search the data by name.
- If information is not available, say so clearly.
- Use delivery/logistics terminology appropriate for a last-mile courier company.
- Format responses with markdown for readability.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
