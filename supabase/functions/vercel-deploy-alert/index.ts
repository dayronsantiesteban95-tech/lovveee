import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TELEGRAM_API = "https://api.telegram.org";

interface VercelWebhookPayload {
  type: string;
  payload: {
    deployment: {
      id: string;
      url: string;
      name: string;
    };
    target?: string;
    links?: {
      deployment?: string;
      project?: string;
    };
  };
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<void> {
  const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Telegram API error: ${err}`);
  }
}

function formatTimestamp(): string {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/Phoenix",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }) + " MST";
}

function buildMessage(event: VercelWebhookPayload): string {
  const { type, payload } = event;
  const deployId = payload.deployment.id ?? "unknown";
  const shortId = deployId.startsWith("dpl_")
    ? deployId.slice(4, 12)
    : deployId.slice(0, 8);
  const timestamp = formatTimestamp();
  const deployLink = payload.links?.deployment ?? "https://vercel.com/dashboard";

  if (type === "deployment.succeeded") {
    return (
      `✅ <b>ANIKA DEPLOY SUCCESS</b>\n\n` +
      `🌐 dispatch.anikalogistics.com is live\n` +
      `📦 Build: ${shortId}\n` +
      `⏱️ ${timestamp}\n\n` +
      `All systems go.`
    );
  }

  if (type === "deployment.error" || type === "deployment.canceled") {
    return (
      `🚨 <b>ANIKA DEPLOY FAILED</b>\n\n` +
      `❌ dispatch.anikalogistics.com may be down\n` +
      `📦 Build: ${shortId}\n` +
      `⏱️ ${timestamp}\n\n` +
      `Check Vercel dashboard immediately.\n` +
      `🔗 <a href="${deployLink}">View deployment</a>`
    );
  }

  if (type === "deployment.created") {
    const target = payload.target ?? "unknown";
    return (
      `🚀 <b>ANIKA DEPLOY STARTED</b>\n\n` +
      `🎯 Target: ${target}\n` +
      `📦 Build: ${shortId}\n` +
      `⏱️ ${timestamp}\n\n` +
      `Deploying dispatch.anikalogistics.com…`
    );
  }

  // Fallback for unknown event types
  return (
    `ℹ️ <b>ANIKA DEPLOY EVENT</b>: ${type}\n` +
    `📦 Build: ${shortId}\n` +
    `⏱️ ${timestamp}`
  );
}

serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!botToken || !chatId) {
      console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
      return new Response(
        JSON.stringify({ error: "Missing Telegram configuration" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json() as VercelWebhookPayload;
    console.log("Received Vercel webhook:", JSON.stringify(body));

    const message = buildMessage(body);
    await sendTelegramMessage(botToken, chatId, message);

    console.log("Telegram notification sent for event:", body.type);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
