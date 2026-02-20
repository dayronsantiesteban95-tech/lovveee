/**
 * Supabase Edge Function: onfleet-proxy
 *
 * Proxies requests to the Onfleet API, keeping the API key server-side.
 * Deploy with: supabase functions deploy onfleet-proxy
 *
 * Supported actions:
 *   listWorkers       -- GET /workers (with GPS filter)
 *   getTask           -- GET /tasks/:id
 *   listTasks         -- GET /tasks/all?from=&to=
 *   createTask        -- POST /tasks
 *   updateTask        -- PUT /tasks/:id
 *   completeTask      -- POST /tasks/:id/complete
 *   getWorkerLocation -- GET /workers/:id
 *   deleteTask        -- DELETE /tasks/:id
 *   autoAssign        -- POST /containers/teams/:id/tasks (Onfleet auto-assign)
 *
 * Required secrets:
 *   supabase secrets set ONFLEET_API_KEY=<your-key>
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ONFLEET_BASE = "https://onfleet.com/api/v2";

// Allowed origins for CORS (add your production domain)
const ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:8788",
];

function getCorsHeaders(origin: string | null) {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    // In development, allow all origins; tighten in production
    headers["Access-Control-Allow-Origin"] = origin ?? "*";
    return headers;
}

serve(async (req) => {
    const origin = req.headers.get("origin");
    const headers = getCorsHeaders(origin);

    if (req.method === "OPTIONS") return new Response("ok", { headers });

    try {
        const apiKey = Deno.env.get("ONFLEET_API_KEY");
        if (!apiKey) throw new Error("ONFLEET_API_KEY not set. Run: supabase secrets set ONFLEET_API_KEY=<key>");

        const { action, ...params } = await req.json();
        if (!action || typeof action !== "string") {
            throw new Error("Missing required 'action' field in request body");
        }

        const auth = btoa(`${apiKey}:`);
        const authHeaders: HeadersInit = {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
        };

        let url = "";
        let method = "GET";
        let body: string | undefined;

        switch (action) {
            // -- Read operations ---------------------
            case "listWorkers":
                // Optional: ?filter=all | ?states=0,1
                url = `${ONFLEET_BASE}/workers`;
                if (params.filter) url += `?filter=${params.filter}`;
                break;

            case "getTask":
                if (!params.taskId) throw new Error("taskId is required");
                url = `${ONFLEET_BASE}/tasks/${params.taskId}`;
                break;

            case "listTasks":
                if (!params.from || !params.to) throw new Error("from and to timestamps required");
                url = `${ONFLEET_BASE}/tasks/all?from=${params.from}&to=${params.to}`;
                if (params.state !== undefined) url += `&state=${params.state}`;
                break;

            case "getWorkerLocation":
                if (!params.workerId) throw new Error("workerId is required");
                url = `${ONFLEET_BASE}/workers/${params.workerId}`;
                break;

            // -- Write operations --------------------
            case "createTask": {
                url = `${ONFLEET_BASE}/tasks`;
                method = "POST";
                // Validate required fields for Onfleet task creation
                if (!params.destination) throw new Error("destination is required to create a task");
                if (!params.recipients || !Array.isArray(params.recipients)) {
                    throw new Error("recipients array is required");
                }
                body = JSON.stringify({
                    destination: params.destination,
                    recipients: params.recipients,
                    notes: params.notes ?? "",
                    completeAfter: params.completeAfter ?? undefined,
                    completeBefore: params.completeBefore ?? undefined,
                    pickupTask: params.pickupTask ?? false,
                    quantity: params.quantity ?? 1,
                    serviceTime: params.serviceTime ?? 5,
                    metadata: params.metadata ?? [],
                    ...(params.container ? { container: params.container } : {}),
                });
                break;
            }

            case "updateTask": {
                if (!params.taskId) throw new Error("taskId is required");
                url = `${ONFLEET_BASE}/tasks/${params.taskId}`;
                method = "PUT";
                // Only send the fields being updated
                const updatePayload: Record<string, unknown> = {};
                if (params.notes !== undefined) updatePayload.notes = params.notes;
                if (params.completeAfter !== undefined) updatePayload.completeAfter = params.completeAfter;
                if (params.completeBefore !== undefined) updatePayload.completeBefore = params.completeBefore;
                if (params.destination !== undefined) updatePayload.destination = params.destination;
                if (params.recipients !== undefined) updatePayload.recipients = params.recipients;
                if (params.container !== undefined) updatePayload.container = params.container;
                if (params.metadata !== undefined) updatePayload.metadata = params.metadata;
                body = JSON.stringify(updatePayload);
                break;
            }

            case "completeTask": {
                if (!params.taskId) throw new Error("taskId is required");
                url = `${ONFLEET_BASE}/tasks/${params.taskId}/complete`;
                method = "POST";
                body = JSON.stringify({
                    completionDetails: {
                        success: params.success ?? true,
                        notes: params.completionNotes ?? "",
                    },
                });
                break;
            }

            case "deleteTask": {
                if (!params.taskId) throw new Error("taskId is required");
                url = `${ONFLEET_BASE}/tasks/${params.taskId}`;
                method = "DELETE";
                break;
            }

            case "autoAssign": {
                // Onfleet team-based auto-assignment
                if (!params.teamId) throw new Error("teamId is required for auto-assign");
                url = `${ONFLEET_BASE}/containers/teams/${params.teamId}`;
                method = "PUT";
                body = JSON.stringify({
                    tasks: params.taskIds ?? [],
                    considerDependencies: params.considerDependencies ?? true,
                });
                break;
            }

            default:
                throw new Error(`Unknown action: "${action}". Available: listWorkers, getTask, listTasks, createTask, updateTask, completeTask, deleteTask, autoAssign`);
        }

        const resp = await fetch(url, { method, headers: authHeaders, body });
        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
            const errMsg = (data as any)?.message?.message   // Onfleet nests errors
                ?? (data as any)?.message
                ?? `Onfleet API error ${resp.status}`;
            throw new Error(errMsg);
        }

        return new Response(JSON.stringify(data), { headers, status: 200 });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return new Response(
            JSON.stringify({ error: message }),
            { headers, status: 400 },
        );
    }
});
