// 15 unique professional email templates for Anika Logistics Group
// Replicated across 3 hubs (atlanta, phoenix, la) = 45 total

type TemplateData = {
  name: string;
  step_type: string;
  subject: string;
  body: string;
};

const UNIQUE_TEMPLATES: TemplateData[] = [
  // ── STEP 1: Day 1 — Introduction (email_1) ──
  {
    name: "The Straight Shooter",
    step_type: "email_1",
    subject: "Quick question about [Company]'s deliveries",
    body: `Hi [Name],

I'll keep this short — I run business development at Anika Logistics Group, and we specialize in time-critical deliveries for [Industry] companies in the [City Hub] area.

We're not a marketplace or a broker. We operate our own fleet (cargo vans, sprinters, box trucks) with TSA-trained, uniformed personnel who treat every package like it matters — because it does.

If [Company] ever deals with missed ETAs, damaged goods, or zero visibility on deliveries, I'd love a quick conversation about how we handle things differently.

Worth a 10-minute call this week?

Best,
Anika Logistics Group
www.anikalogisticsgroup.com`,
  },
  {
    name: "The Problem Solver",
    step_type: "email_1",
    subject: "Delivery headaches in [City Hub]? We fix those.",
    body: `Hi [Name],

Most [Industry] companies I talk to in [City Hub] share the same frustrations: late deliveries, no communication from the driver, and zero proof that a package actually arrived.

At Anika Logistics Group, we built our entire operation around eliminating those problems:

• Real-time GPS tracking on every route
• Photo proof of delivery on every stop
• Dedicated dispatch — you always know who to call
• Same-day and 6-hour hotshot options when it's urgent

If any of that sounds relevant to [Company], I'd love to set up a quick intro call.

No pitch — just a conversation to see if we're a fit.

Best,
Anika Logistics Group`,
  },
  {
    name: "The Warm Referral",
    step_type: "email_1",
    subject: "[Name], a quick note from Anika Logistics",
    body: `Hi [Name],

I came across [Company] while researching [Industry] businesses in [City Hub], and I think there might be a natural fit with what we do at Anika Logistics Group.

We handle last-mile, white-glove, and time-critical deliveries for companies that can't afford missed windows or damaged freight. Our team operates 24/7 with our own fleet — no subcontractors, no surprises.

I work with several [Industry] companies in the area and understand the delivery challenges unique to your space.

Would you be open to a brief conversation? Even if the timing isn't right, happy to be a resource.

Warm regards,
Anika Logistics Group`,
  },
  {
    name: "The Value Lead",
    step_type: "email_1",
    subject: "How [Industry] companies cut delivery failures by 40%",
    body: `Hi [Name],

[Industry] companies that switch from traditional couriers to a dedicated logistics partner typically see a 30-40% reduction in delivery failures within the first 90 days.

The difference? Accountability.

At Anika Logistics Group, every delivery is tracked in real time, every driver is uniformed and TSA-trained, and every route has a dedicated dispatcher behind it. We offer last-mile, white-glove, AOG, and same-day services — all from our own fleet.

If [Company] is looking for more reliability in [City Hub], I'd love to show you how we operate.

Quick call this week?

Best,
Anika Logistics Group`,
  },
  {
    name: "The Local Partner",
    step_type: "email_1",
    subject: "Your [City Hub] logistics partner — quick intro",
    body: `Hi [Name],

My name's Dayron, and I lead Anika Logistics Group out of [City Hub].

We're a local logistics company with a simple promise: we move what matters — on time, every time. Our team is available 24/7, operates our own fleet of cargo vans, sprinters, and box trucks, and every team member is uniformed, background-checked, and TSA-trained.

We serve [Industry] companies across [City Hub] with:
→ Last-mile & same-day delivery
→ White-glove & hand-carry service
→ 6-hour hotshot for emergencies
→ Airport transfers & AOG support

I'd love to introduce Anika to [Company] — even just a quick call to see if we can help.

Looking forward to it,
Dayron Santiesteban
Anika Logistics Group`,
  },

  // ── STEP 2: Day 4 — Social Proof (email_2) ──
  {
    name: "The Case Study",
    step_type: "email_2",
    subject: "How we handle [Industry] deliveries in [City Hub]",
    body: `Hi [Name],

I wanted to follow up with a real example of what we do at Anika.

One of our [Industry] clients in [City Hub] needed 47 time-sensitive packages delivered across 12 locations — all before noon. Their previous courier missed 6 stops. We haven't missed one since taking over.

Here's how we did it:
• Pre-routed every stop the night before
• Assigned two dedicated drivers with real-time tracking
• Dispatched a backup vehicle on standby
• Delivered photo proof of every single drop-off

That's not a special occasion for us — that's Tuesday.

If [Company] needs that kind of reliability, let's talk.

Best,
Anika Logistics Group`,
  },
  {
    name: "The Numbers",
    step_type: "email_2",
    subject: "Re: Quick question about [Company]'s deliveries",
    body: `Hi [Name],

Just circling back on my earlier note. I wanted to share a few things about our operation that might be relevant to [Company]:

Fleet: Cargo vans, sprinters, box trucks — all company-owned
Coverage: Full [City Hub] metro + surrounding 300-mile radius
Response time: Same-day dispatch, 6-hour hotshot available
Personnel: Uniformed, TSA-trained, background-checked
Tracking: Real-time GPS + photo proof of delivery on every stop

We currently serve [Industry] companies in [City Hub] and I think there's a strong fit here.

Happy to jump on a quick call whenever works for you.

Best,
Anika Logistics Group`,
  },
  {
    name: "The Trust Builder",
    step_type: "email_2",
    subject: "[Name], just following up",
    body: `Hi [Name],

I know your inbox is busy, so I'll be quick.

I reached out a few days ago about Anika Logistics Group and how we support [Industry] companies in [City Hub]. Our philosophy is simple: trust is earned through consistency — and we prove it on every delivery.

No long-term contracts required. No hidden fees. Just reliable, professional delivery service backed by our own fleet and a team that takes ownership.

If you're open to a conversation, I'd love to learn more about [Company]'s logistics needs. And if the timing isn't right, no pressure at all.

Best,
Anika Logistics Group`,
  },
  {
    name: "The Service Menu",
    step_type: "email_2",
    subject: "8 ways Anika can support [Company]",
    body: `Hi [Name],

I wanted to make sure you knew the full scope of what Anika Logistics Group offers in [City Hub]. Here's a quick snapshot:

1. Last-Mile Delivery — reliable, tracked, on-time
2. White-Glove Service — for fragile, high-value, or sensitive cargo
3. AOG (Aircraft on Ground) — urgent aerospace parts delivery
4. Same-Day Rush — when it absolutely can't wait
5. 6-Hour Hotshot — emergency door-to-door
6. Airport Transfers — TSA-trained personnel, secure chain of custody
7. Legal Courier — court filings, sensitive documents, certified delivery
8. Hand Carry — dedicated person, dedicated route, no stops

Every service runs on our own fleet with real-time tracking and photo proof of delivery.

Which of these would be most useful for [Company]? Happy to put together a custom plan.

Best,
Anika Logistics Group`,
  },
  {
    name: "The Differentiator",
    step_type: "email_2",
    subject: "What makes us different from your current provider",
    body: `Hi [Name],

If [Company] already has a delivery partner, you might be wondering why I'm reaching out. Fair question.

Here's what I hear from companies that switch to Anika:

"Our old provider missed ETAs constantly." → We track every route in real time and proactively communicate delays before they happen.

"We never knew if the package actually arrived." → Every delivery gets photo proof, a timestamp, and a recipient signature.

"We couldn't get anyone on the phone." → You get a dedicated dispatcher. One number. Always answered.

"Drivers showed up in personal vehicles looking unprofessional." → Our team is uniformed, background-checked, and TSA-trained. Every time.

We're not the cheapest option — but we are the most reliable. And for [Industry] companies, that matters.

Worth a conversation?

Best,
Anika Logistics Group`,
  },

  // ── STEP 3: Day 8 — Low Friction Offer (call) ──
  {
    name: "The Pilot Offer",
    step_type: "call",
    subject: "Let's do a trial run, [Name] — zero commitment",
    body: `Hi [Name],

I've reached out a couple of times, and I know timing is everything. So here's a simple offer:

Let us do one delivery for [Company] — on us. A trial run so you can see exactly how Anika operates: the tracking, the communication, the professionalism, the proof of delivery.

No contract. No obligation. Just a chance to show you why [Industry] companies in [City Hub] trust us with their most important deliveries.

If you're interested, just reply with a good time to chat for 10 minutes and we'll set it up.

Best,
Dayron Santiesteban
Anika Logistics Group
www.anikalogisticsgroup.com`,
  },
  {
    name: "The Quick Call",
    step_type: "call",
    subject: "15 minutes to see if we're a fit?",
    body: `Hi [Name],

I know I've been in your inbox a few times now — I appreciate your patience.

I'm not looking for a hard sell. Just 15 minutes to understand [Company]'s delivery needs and share how Anika handles [Industry] logistics in [City Hub].

If there's a fit, great. If not, you'll at least have a backup logistics partner you can call when things get hectic.

What does your calendar look like this week?

Best,
Anika Logistics Group`,
  },
  {
    name: "The Last Touch",
    step_type: "call",
    subject: "[Name], one last thing before I go quiet",
    body: `Hi [Name],

I'll respect your time — this is my last note for now.

If [Company] ever needs a reliable delivery partner in [City Hub] — whether it's a same-day emergency, a recurring last-mile route, or a white-glove job — Anika Logistics Group is here.

We operate 24/7. Our own fleet. Uniformed, TSA-trained team. Real-time tracking on every delivery.

Feel free to reach out whenever the timing is right. I'll be here.

Best,
Dayron Santiesteban
Anika Logistics Group
dayron@anikalogisticsgroup.com`,
  },
  {
    name: "The Custom Quote",
    step_type: "call",
    subject: "Custom logistics quote for [Company]",
    body: `Hi [Name],

Before I go quiet, I wanted to offer one more thing — a custom logistics quote for [Company].

If you can share a few details (typical delivery volume, routes, and any special requirements), I'll put together a no-obligation proposal tailored to [Company]'s needs.

No pressure, no follow-up calls unless you want them. Just a clear picture of what Anika can do for you in [City Hub].

Interested? Just reply to this email and I'll take it from there.

Best,
Anika Logistics Group`,
  },
  {
    name: "The Direct Line",
    step_type: "call",
    subject: "My direct line for [Company]",
    body: `Hi [Name],

I'll keep this one short.

If [Company] ever needs same-day delivery, hotshot service, or a reliable logistics partner in [City Hub] — here's my direct line:

📱 (305) 555-0100
📧 dayron@anikalogisticsgroup.com
🕐 Available Mon-Sun, 6 AM - 10 PM

No gatekeepers, no phone tree. Just me.

Whenever you're ready, I'm here.

Best,
Dayron Santiesteban
Anika Logistics Group`,
  },
];

const HUBS = ["atlanta", "phoenix", "la"];

export function getAnikaTemplates(): { name: string; hub: string; step_type: string; subject: string; body: string }[] {
  const templates: { name: string; hub: string; step_type: string; subject: string; body: string }[] = [];
  for (const hub of HUBS) {
    for (const t of UNIQUE_TEMPLATES) {
      templates.push({
        name: t.name,
        hub,
        step_type: t.step_type,
        subject: t.subject,
        body: t.body,
      });
    }
  }
  return templates;
}
