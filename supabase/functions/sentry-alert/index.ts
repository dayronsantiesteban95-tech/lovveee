import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sentry-hook-signature',
}

interface SentryIssue {
  id: string
  title: string
  culprit?: string
  permalink?: string
  shortId?: string
  status?: string
  level?: string
  count?: number
  userCount?: number
  firstSeen?: string
  lastSeen?: string
  project?: {
    name: string
    slug: string
  }
}

interface SentryEvent {
  action: string
  data: {
    issue?: SentryIssue
    error?: {
      title?: string
    }
  }
  actor?: {
    name?: string
    email?: string
  }
  installation?: {
    uuid?: string
  }
}

function formatTimestamp(iso?: string): string {
  if (!iso) return 'N/A'
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/Phoenix',
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function buildTelegramMessage(event: SentryEvent): string {
  const issue = event.data?.issue
  const action = event.action ?? 'unknown'

  const emoji = action === 'created' ? '🚨' : action === 'resolved' ? '✅' : '⚠️'
  const actionLabel = action === 'created' ? 'NEW ERROR' : action === 'resolved' ? 'RESOLVED' : action.toUpperCase()

  const title = issue?.title ?? 'Unknown Error'
  const level = issue?.level ? ` [${issue.level.toUpperCase()}]` : ''
  const project = issue?.project?.name ?? 'Anika Dispatcher'
  const usersAffected = issue?.userCount ?? 0
  const eventCount = issue?.count ?? 0
  const timestamp = formatTimestamp(issue?.lastSeen)
  const url = issue?.permalink ?? 'https://sentry.io'
  const culprit = issue?.culprit ? `\n📍 Location: ${issue.culprit}` : ''

  return [
    `${emoji} *ANIKA ALERT -- ${actionLabel}*${level}`,
    ``,
    `*Error:* ${escapeMarkdown(title)}`,
    `*Project:* ${escapeMarkdown(project)}${culprit}`,
    `*Users affected:* ${usersAffected}`,
    `*Event count:* ${eventCount}`,
    `*Time:* ${timestamp}`,
    ``,
    `🔗 [View in Sentry](${url})`,
  ].join('\n')
}

function escapeMarkdown(text: string): string {
  // Escape special characters for Telegram MarkdownV2 -- use basic Markdown (V1) here
  return text.replace(/[`*_[\]]/g, '\\$&')
}

async function sendTelegramMessage(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured')
  }

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Telegram API error: ${err}`)
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.text()

    // Parse the Sentry webhook payload
    let event: SentryEvent
    try {
      event = JSON.parse(body)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Only handle issue events
    const action = event?.action
    if (!action || !['created', 'resolved', 'assigned', 'ignored'].includes(action)) {
      return new Response(JSON.stringify({ skipped: true, reason: `action=${action}` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Skip ignored/assigned unless you want them
    if (action === 'ignored' || action === 'assigned') {
      return new Response(JSON.stringify({ skipped: true, reason: `action=${action}` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const message = buildTelegramMessage(event)
    await sendTelegramMessage(message)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('sentry-alert error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
