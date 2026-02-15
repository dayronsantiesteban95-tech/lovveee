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
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ZOOMINFO_API_KEY = Deno.env.get("ZOOMINFO_API_KEY");
    const ZOOMINFO_USERNAME = Deno.env.get("ZOOMINFO_USERNAME");
    const ZOOMINFO_PASSWORD = Deno.env.get("ZOOMINFO_PASSWORD");

    const body = await req.json();
    const { action, filters, contact_id, contact_data } = body;

    if (!ZOOMINFO_API_KEY && (!ZOOMINFO_USERNAME || !ZOOMINFO_PASSWORD)) {
      return new Response(
        JSON.stringify({ success: false, error: "ZoomInfo credentials are not configured. Please add ZOOMINFO_API_KEY (or ZOOMINFO_USERNAME + ZOOMINFO_PASSWORD) in Supabase Edge Function secrets." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 1: Authenticate with ZoomInfo ──
    let accessToken = ZOOMINFO_API_KEY;

    if (!accessToken) {
      const authRes = await fetch("https://api.zoominfo.com/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: ZOOMINFO_USERNAME,
          password: ZOOMINFO_PASSWORD,
        }),
      });

      if (!authRes.ok) {
        const errText = await authRes.text();
        throw new Error(`ZoomInfo auth failed [${authRes.status}]: ${errText}`);
      }

      const authData = await authRes.json();
      accessToken = authData.jwt;
    }

    const ziHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    // ── Action: Search Contacts ──
    if (action === "search") {
      const {
        jobTitle = "Logistics Manager",
        industry = "Aerospace",
        state,
        city,
        companyName,
        page = 1,
        pageSize = 25,
      } = filters || {};

      const searchBody: Record<string, unknown> = {
        maxResults: pageSize,
        page,
        outputFields: [
          "id", "firstName", "lastName", "email", "phone", "jobTitle",
          "companyName", "companyId", "industry", "city", "state",
          "companyRevenue", "companyEmployeeCount", "linkedinUrl",
        ],
      };

      // Build person search criteria
      if (jobTitle) {
        searchBody.jobTitleSearchCriteria = {
          jobTitles: [jobTitle],
          jobTitleSearchType: "contains",
        };
      }
      if (industry) {
        searchBody.industrySearchCriteria = {
          industries: [industry],
        };
      }
      if (state) {
        searchBody.locationSearchCriteria = {
          states: [state],
        };
      }
      if (city) {
        searchBody.locationSearchCriteria = {
          ...(searchBody.locationSearchCriteria as object || {}),
          cities: [city],
        };
      }
      if (companyName) {
        searchBody.companySearchCriteria = {
          companyNames: [companyName],
        };
      }

      const searchRes = await fetch("https://api.zoominfo.com/search/contact", {
        method: "POST",
        headers: ziHeaders,
        body: JSON.stringify(searchBody),
      });

      if (!searchRes.ok) {
        const errText = await searchRes.text();
        console.error("ZoomInfo search error:", searchRes.status, errText);
        throw new Error(`ZoomInfo search failed [${searchRes.status}]: ${errText}`);
      }

      const searchData = await searchRes.json();

      return new Response(
        JSON.stringify({
          success: true,
          contacts: searchData.data || [],
          totalResults: searchData.totalResults || 0,
          currentPage: page,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Action: Import Contact to CRM ──
    if (action === "import") {
      if (!contact_id) {
        return new Response(
          JSON.stringify({ error: "contact_id is required for import" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // The contact data is sent directly from the frontend
      // since we already have it from the search results

      if (!contact_data) {
        return new Response(
          JSON.stringify({ error: "contact_data is required for import" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userId = user.id;

      // Determine city_hub based on state/city from ZoomInfo data
      const stateToHub: Record<string, string> = {
        GA: "atlanta", FL: "atlanta", AL: "atlanta", SC: "atlanta", NC: "atlanta",
        TN: "atlanta", MS: "atlanta", VA: "atlanta", KY: "atlanta", LA: "atlanta",
        AZ: "phoenix", NM: "phoenix", TX: "phoenix", CO: "phoenix", UT: "phoenix",
        NV: "phoenix", OK: "phoenix",
        CA: "la", OR: "la", WA: "la", HI: "la", AK: "la", ID: "la",
      };
      const cityToHub: Record<string, string> = {
        atlanta: "atlanta", phoenix: "phoenix", scottsdale: "phoenix",
        "los angeles": "la", "san francisco": "la", "san diego": "la",
        miami: "atlanta", orlando: "atlanta", dallas: "phoenix", houston: "phoenix",
        austin: "phoenix", denver: "phoenix", seattle: "la", portland: "la",
      };
      let cityHub = "phoenix"; // default to central hub
      if (contact_data.city) {
        const normalizedCity = contact_data.city.toLowerCase().trim();
        if (cityToHub[normalizedCity]) cityHub = cityToHub[normalizedCity];
      }
      if (contact_data.state) {
        const normalizedState = contact_data.state.toUpperCase().trim();
        if (stateToHub[normalizedState]) cityHub = stateToHub[normalizedState];
      }

      // Insert into leads table
      const { data: lead, error: insertError } = await supabase
        .from("leads")
        .insert({
          company_name: contact_data.companyName || "Unknown Company",
          contact_person: `${contact_data.firstName || ""} ${contact_data.lastName || ""}`.trim(),
          email: contact_data.email || null,
          phone: contact_data.phone || null,
          industry: contact_data.industry || null,
          city_hub: cityHub,
          stage: "new_lead",
          enrichment_source: "zoominfo",
          enrichment_data: contact_data,
          created_by: userId,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Lead insert error:", insertError);
        throw new Error(`Failed to import lead: ${insertError.message}`);
      }

      return new Response(
        JSON.stringify({ success: true, lead }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'search' or 'import'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("enrich-leads error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
