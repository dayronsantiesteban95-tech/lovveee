import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAnikaTemplates } from "@/lib/anikaTemplates";
import { createSequenceForLead } from "@/lib/sequenceUtils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Mail, Phone, Clock, ChevronDown, ChevronRight, Copy, Plus, Pencil, Trash2,
  Play, CheckCircle, PhoneCall, AlertCircle, Settings, RotateCcw, Snowflake, ArrowRight,
  Calendar, Wrench, Hand, Send, Loader2,
} from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";

type LeadWithSequences = {
  id: string;
  company_name: string;
  contact_person: string;
  city_hub: string | null;
  industry: string | null;
  email: string | null;
  stage: string;
};

type SequenceStep = {
  id: string;
  lead_id: string;
  step_type: string;
  status: string;
  follow_up_date: string | null;
  sent_at: string | null;
  response_status: string;
  note: string | null;
  manual_mode: boolean;
  created_at: string;
  leads?: LeadWithSequences;
};

type EmailTemplate = {
  id: string;
  name: string;
  hub: string;
  step_type: string;
  subject: string;
  body: string;
  created_by: string | null;
};

type NurtureSettings = {
  email1_to_email2_days: number;
  email2_to_call_days: number;
  no_response_snooze_days: number;
};

const DEFAULT_SETTINGS: NurtureSettings = {
  email1_to_email2_days: 3,
  email2_to_call_days: 4,
  no_response_snooze_days: 3,
};

const STEP_LABELS: Record<string, string> = {
  email_1: "Day 1 - Introduction",
  email_2: "Day 4 - Social Proof",
  call: "Day 8 - Low Friction Offer",
};

const STEP_ICONS: Record<string, React.ReactNode> = {
  email_1: <Mail className="h-3.5 w-3.5" />,
  email_2: <Mail className="h-3.5 w-3.5" />,
  call: <Phone className="h-3.5 w-3.5" />,
};

const HUBS = ["atlanta", "phoenix", "la"];
const HUB_LABELS: Record<string, string> = { atlanta: "Atlanta", phoenix: "Phoenix", la: "LA" };

// ── Dynamic template variable replacement ──
function replaceTemplateVars(text: string, lead?: LeadWithSequences | null): string {
  if (!text || !lead) return text;
  return text
    .replace(/\[Name\]/gi, lead.contact_person || "")
    .replace(/\[Company\]/gi, lead.company_name || "")
    .replace(/\[City Hub\]/gi, lead.city_hub || "")
    .replace(/\[Industry\]/gi, lead.industry || "");
}

// ── Visual Decision Tree ──
function DecisionTree() {
  const steps = [
    { key: "email_1", label: "Day 1 - Intro", icon: <Mail className="h-4 w-4" /> },
    { key: "email_2", label: "Day 4 - Proof", icon: <Mail className="h-4 w-4" /> },
    { key: "call", label: "Day 8 - Offer", icon: <Phone className="h-4 w-4" /> },
  ];
  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Anika Outreach Flow</p>
        <div className="flex items-start gap-0 overflow-x-auto">
          {steps.map((step, i) => (
            <div key={step.key} className="flex items-start">
              <div className="flex flex-col items-center min-w-[100px]">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-medium text-xs border border-primary/20">
                  {step.icon} {step.label}
                </div>
                <div className="flex gap-4 mt-2">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-px h-3 bg-green-500" />
                    <span className="text-[9px] text-green-600 font-medium">Replied</span>
                    <div className="w-px h-2 bg-green-500" />
                    <Badge variant="outline" className="text-[8px] px-1 py-0 border-green-500/30 text-green-600">QUALIFIED</Badge>
                    <div className="w-px h-2 bg-emerald-500" />
                    <span className="text-[9px] text-emerald-600 font-medium">Interested</span>
                    <Badge variant="outline" className="text-[8px] px-1 py-0 border-emerald-500/30 text-emerald-600">🟢 FLAG</Badge>
                  </div>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="flex flex-col items-center mt-2 mx-1">
                  <span className="text-[9px] text-muted-foreground mb-0.5">No Response</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Progress Bar (3 segments) with label ──
function SequenceProgressBar({ steps }: { steps: SequenceStep[] }) {
  const ordered = ["email_1", "email_2", "call"];
  const sentCount = ordered.filter((st) => {
    const s = steps.find((x) => x.step_type === st);
    return s?.status === "completed";
  }).length;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {ordered.map((st) => {
          const s = steps.find((x) => x.step_type === st);
          let color = "bg-muted";
          if (s?.status === "completed") color = "bg-green-500";
          else if (s?.status === "pending") color = "bg-primary";
          else if (s?.status === "paused") color = "bg-amber-400";
          return <div key={st} className={`h-1.5 w-6 rounded-full ${color}`} title={`${STEP_LABELS[st]}: ${s?.status || "not started"}`} />;
        })}
      </div>
      <span className="text-[10px] text-muted-foreground font-medium">{sentCount}/3 sent</span>
    </div>
  );
}

export default function NurtureEngine() {
  const { user } = useAuth();
  const { isOwner } = useUserRole();
  const { toast } = useToast();

  // Settings
  const [settings, setSettings] = useState<NurtureSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState(DEFAULT_SETTINGS);

  // Follow-Up Today
  const [followUps, setFollowUps] = useState<SequenceStep[]>([]);
  const [followUpLeads, setFollowUpLeads] = useState<Record<string, LeadWithSequences>>({});

  // Sequences (tracker)
  const [trackerLeads, setTrackerLeads] = useState<LeadWithSequences[]>([]);
  const [leadSequences, setLeadSequences] = useState<Record<string, SequenceStep[]>>({});
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  // Cold leads
  const [coldLeads, setColdLeads] = useState<{ lead: LeadWithSequences; steps: SequenceStep[] }[]>([]);
  const [showCold, setShowCold] = useState(false);

  // Needs Attention
  const [attentionSteps, setAttentionSteps] = useState<SequenceStep[]>([]);
  const [attentionLeads, setAttentionLeads] = useState<Record<string, LeadWithSequences>>({});

  // Template Library
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [hubFilter, setHubFilter] = useState("all");
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editTemplate, setEditTemplate] = useState<EmailTemplate | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");

  // ── Fetch Settings ──
  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from("nurture_settings").select("setting_key, setting_value");
    if (data) {
      const s = { ...DEFAULT_SETTINGS };
      for (const row of data) {
        const key = row.setting_key as keyof NurtureSettings;
        if (key in s) (s as Record<string, number>)[key] = parseInt(row.setting_value) || (DEFAULT_SETTINGS as Record<string, number>)[key];
      }
      setSettings(s);
      setSettingsForm(s);
    }
  }, []);

  // ── Save Settings ──
  const saveSettings = async () => {
    if (!user) return;
    const entries = Object.entries(settingsForm) as [string, number][];
    for (const [key, value] of entries) {
      await supabase.from("nurture_settings").upsert(
        { setting_key: key, setting_value: String(value), updated_by: user.id },
        { onConflict: "setting_key" }
      );
    }
    setSettings(settingsForm);
    setShowSettings(false);
    toast({ title: "Settings saved" });
  };

  // ── Fetch Follow-Up Today ──
  const fetchFollowUps = useCallback(async () => {
    const { data } = await supabase
      .from("lead_sequences")
      .select("*")
      .lte("follow_up_date", today)
      .eq("status", "pending")
      .neq("response_status", "cold")
      .order("follow_up_date", { ascending: true });
    if (!data) return;
    setFollowUps(data as SequenceStep[]);
    const leadIds = [...new Set(data.map((d: any) => d.lead_id))];
    if (leadIds.length) {
      const { data: leads } = await supabase
        .from("leads")
        .select("id, company_name, contact_person, city_hub, industry, email, stage")
        .in("id", leadIds);
      if (leads) {
        const map: Record<string, LeadWithSequences> = {};
        for (const l of leads) map[l.id] = l as LeadWithSequences;
        setFollowUpLeads(map);
      }
    }
  }, [today]);

  // ── Fetch Needs Attention ──
  const fetchAttention = useCallback(async () => {
    const { data } = await supabase
      .from("lead_sequences")
      .select("*")
      .in("response_status", ["replied", "interested_call"])
      .neq("status", "completed")
      .order("updated_at", { ascending: false });
    if (!data) return;
    setAttentionSteps(data as SequenceStep[]);
    const leadIds = [...new Set(data.map((d: any) => d.lead_id))];
    if (leadIds.length) {
      const { data: leads } = await supabase
        .from("leads")
        .select("id, company_name, contact_person, city_hub, industry, email, stage")
        .in("id", leadIds);
      if (leads) {
        const map: Record<string, LeadWithSequences> = {};
        for (const l of leads) map[l.id] = l as LeadWithSequences;
        setAttentionLeads(map);
      }
    }
  }, []);

  // ── Fetch Sequence Tracker ──
  const fetchTracker = useCallback(async () => {
    const { data: leads } = await supabase
      .from("leads")
      .select("id, company_name, contact_person, city_hub, industry, email, stage")
      .eq("stage", "new_lead")
      .order("created_at", { ascending: false });
    if (!leads) return;
    setTrackerLeads(leads as LeadWithSequences[]);
    const leadIds = leads.map((l: any) => l.id);
    if (leadIds.length) {
      const { data: seqs } = await supabase
        .from("lead_sequences")
        .select("*")
        .in("lead_id", leadIds)
        .order("created_at", { ascending: true });
      if (seqs) {
        const map: Record<string, SequenceStep[]> = {};
        const coldMap: { lead: LeadWithSequences; steps: SequenceStep[] }[] = [];
        for (const s of seqs as SequenceStep[]) {
          if (!map[s.lead_id]) map[s.lead_id] = [];
          map[s.lead_id].push(s);
        }
        for (const lead of leads as LeadWithSequences[]) {
          const steps = map[lead.id] || [];
          if (steps.length > 0 && steps.some((s) => s.response_status === "cold")) {
            coldMap.push({ lead, steps });
          }
        }
        setLeadSequences(map);
        setColdLeads(coldMap);
      }
    }
  }, []);

  // ── Fetch Templates ──
  const fetchTemplates = useCallback(async () => {
    const { data } = await supabase
      .from("email_templates")
      .select("*")
      .order("hub", { ascending: true });
    if (data) setTemplates(data as EmailTemplate[]);
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchFollowUps();
    fetchTracker();
    fetchTemplates();
    fetchAttention();
  }, [fetchSettings, fetchFollowUps, fetchTracker, fetchTemplates, fetchAttention]);

  // ── Find matching template ──
  const findTemplate = (hub: string | null, stepType: string) => {
    if (!hub) return null;
    return templates.find((t) => t.hub.toLowerCase() === hub.toLowerCase() && t.step_type === stepType) || null;
  };

  // ── Manual Mode Toggle ──
  const toggleManualMode = async (leadId: string, enable: boolean) => {
    const { error } = enable
      ? await supabase
        .from("lead_sequences")
        .update({ manual_mode: true, status: "paused" })
        .eq("lead_id", leadId)
        .eq("status", "pending")
      : await supabase
        .from("lead_sequences")
        .update({ manual_mode: false, status: "pending" })
        .eq("lead_id", leadId)
        .eq("status", "paused");
    if (error) {
      toast({ title: "Toggle failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: enable ? "Manual mode ON" : "Auto-pilot resumed" });
    fetchTracker();
  };

  // ── Bifurcation Actions (original - for Sequences & Follow-Up) ──
  const handleNoResponse = async (step: SequenceStep, note?: string) => {
    const newDate = format(addDays(new Date(), settings.no_response_snooze_days), "yyyy-MM-dd");
    const { error } = await supabase.from("lead_sequences").update({
      follow_up_date: newDate,
      response_status: "no_response",
      ...(note ? { note } : {}),
    }).eq("id", step.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Follow-up rescheduled", description: `Next follow-up in ${settings.no_response_snooze_days} days` });
    fetchFollowUps();
    fetchTracker();
  };

  const handleReplied = async (step: SequenceStep, note?: string) => {
    if (!user) return;
    await supabase.from("lead_sequences").update({
      status: "completed",
      response_status: "replied",
      ...(note ? { note } : {}),
    }).eq("id", step.id);
    // Stop all other pending/paused steps for this lead
    await supabase.from("lead_sequences").update({
      status: "completed",
      response_status: "stopped",
    }).eq("lead_id", step.lead_id).in("status", ["pending", "paused"]).neq("id", step.id);
    await supabase.from("leads").update({ stage: "qualified" }).eq("id", step.lead_id);
    const lead = followUpLeads[step.lead_id] || trackerLeads.find((l) => l.id === step.lead_id);
    await supabase.from("tasks").insert({
      title: `Call ${lead?.company_name || "lead"} - they replied!`,
      status: "todo",
      priority: "high",
      department: "prospecting",
      created_by: user.id,
    });
    toast({ title: "🎉 Lead Replied!", description: `${lead?.company_name} moved to Qualified.` });
    fetchFollowUps();
    fetchTracker();
    fetchAttention();
  };

  const handleInterestedCall = async (step: SequenceStep, note?: string) => {
    // Update sequence status
    await supabase.from("lead_sequences").update({
      response_status: "interested_call",
      status: "completed",
      ...(note ? { note } : {}),
    }).eq("id", step.id);
    // Stop all other pending/paused steps for this lead
    await supabase.from("lead_sequences").update({
      status: "completed",
      response_status: "stopped",
    }).eq("lead_id", step.lead_id).in("status", ["pending", "paused"]).neq("id", step.id);

    // Auto-promote lead to "qualified" stage in the Growth Pipeline
    const stepLabel = STEP_LABELS[step.step_type] || step.step_type;
    await supabase.from("leads").update({
      stage: "qualified",
    }).eq("id", step.lead_id);

    // Log an interaction noting the promotion
    await supabase.from("lead_interactions").insert({
      lead_id: step.lead_id,
      activity_type: "note",
      note: `🟢 Auto-promoted to Qualified — replied "Interested" on ${stepLabel}. ${note || ""}`.trim(),
      created_by: (await supabase.auth.getUser()).data.user?.id,
    });

    toast({ title: "Lead Promoted to Qualified! 🎉", description: "Lead moved to Growth Pipeline and flagged for call scheduling." });
    fetchFollowUps();
    fetchTracker();
    fetchAttention();
  };

  // ── Needs Attention Bifurcation Actions (3 big buttons) ──
  const handleScheduleCall = async (step: SequenceStep) => {
    if (!user) return;
    const lead = attentionLeads[step.lead_id];
    // Move to negotiation
    await supabase.from("leads").update({ stage: "negotiation" }).eq("id", step.lead_id);
    // Mark sequence completed
    await supabase.from("lead_sequences").update({ status: "completed" }).eq("lead_id", step.lead_id);
    // Create task
    await supabase.from("tasks").insert({
      title: `Schedule call with ${lead?.company_name || "lead"}`,
      status: "todo",
      priority: "high",
      department: "prospecting",
      created_by: user.id,
    });
    toast({ title: "📞 Call Scheduled", description: `${lead?.company_name} moved to Negotiation.` });
    fetchAttention();
    fetchTracker();
  };

  const handleNurture30d = async (step: SequenceStep) => {
    const newDate = format(addDays(new Date(), 30), "yyyy-MM-dd");
    await supabase.from("lead_sequences").update({
      follow_up_date: newDate,
      response_status: "nurture_30d",
    }).eq("id", step.id);
    toast({ title: "🔄 30-day nurture", description: "Lead will resurface in 30 days." });
    fetchAttention();
    fetchFollowUps();
  };

  const handleOperationalReview = async (step: SequenceStep) => {
    if (!user) return;
    const lead = attentionLeads[step.lead_id];
    await supabase.from("leads").update({ stage: "operational_review" }).eq("id", step.lead_id);
    await supabase.from("lead_sequences").update({ status: "completed" }).eq("lead_id", step.lead_id);
    await supabase.from("tasks").insert({
      title: `Pre-flight checklist: docks/white-glove for ${lead?.company_name || "lead"}`,
      status: "todo",
      priority: "high",
      department: "operations",
      created_by: user.id,
    });
    toast({ title: "🔧 Operational Review", description: `${lead?.company_name} moved to Operational Review.` });
    fetchAttention();
    fetchTracker();
  };

  // ── End-of-Sequence Actions ──
  const isSequenceExhausted = (steps: SequenceStep[]) => {
    if (steps.length === 0) return false;
    const allSteps = ["email_1", "email_2", "call"];
    return allSteps.every((st) => {
      const s = steps.find((x) => x.step_type === st);
      return s && (s.status === "completed" || s.response_status === "no_response");
    });
  };

  const restartSequence = async (leadId: string) => {
    if (!user) return;
    const ok = await createSequenceForLead(leadId, user.id);
    if (ok) {
      toast({ title: "Sequence restarted", description: "New 3-step cycle created." });
    } else {
      toast({ title: "Failed to restart sequence", variant: "destructive" });
    }
    fetchTracker();
    fetchFollowUps();
  };

  const markCold = async (leadId: string, steps: SequenceStep[]) => {
    const lastStep = steps[steps.length - 1];
    if (lastStep) {
      await supabase.from("lead_sequences").update({ response_status: "cold" }).eq("id", lastStep.id);
    }
    toast({ title: "Lead marked cold", description: "Moved to Cold Leads section." });
    fetchTracker();
    fetchFollowUps();
  };

  const reviveLead = async (leadId: string) => {
    const steps = leadSequences[leadId] || [];
    for (const s of steps) {
      if (s.response_status === "cold") {
        await supabase.from("lead_sequences").update({ response_status: "no_response" }).eq("id", s.id);
      }
    }
    toast({ title: "Lead revived", description: "Lead is back in the tracker." });
    fetchTracker();
  };

  // ── Start Sequence ──
  const startSequence = async (leadId: string) => {
    if (!user) return;
    const ok = await createSequenceForLead(leadId, user.id);
    if (ok) {
      toast({ title: "Sequence Started", description: "3-step outreach sequence created." });
    } else {
      toast({ title: "Failed to start sequence", variant: "destructive" });
    }
    fetchTracker();
  };

  // ── Template CRUD ──
  const handleTemplateSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      hub: fd.get("hub") as string,
      step_type: fd.get("step_type") as string,
      subject: fd.get("subject") as string,
      body: fd.get("body") as string,
    };
    if (editTemplate) {
      await supabase.from("email_templates").update(payload).eq("id", editTemplate.id);
      toast({ title: "Template updated" });
    } else {
      await supabase.from("email_templates").insert({ ...payload, created_by: user.id });
      toast({ title: "Template created" });
    }
    setShowTemplateForm(false);
    setEditTemplate(null);
    fetchTemplates();
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("email_templates").delete().eq("id", id);
    fetchTemplates();
    toast({ title: "Template deleted" });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
  };

  // ── Send Email via Edge Function ──
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [seedingTemplates, setSeedingTemplates] = useState(false);

  // ── Auto-Send State ──
  const autoSendRan = useRef(false);
  const [autoSending, setAutoSending] = useState(false);
  const [autoSendResults, setAutoSendResults] = useState<{ sent: number; failed: number; skipped: number; details: string[] } | null>(null);

  // ── Auto-Send Due Emails ──
  const autoSendDueEmails = useCallback(async (isManualTrigger = false) => {
    if (autoSending) return;
    if (!user) return;
    setAutoSending(true);
    const results = { sent: 0, failed: 0, skipped: 0, details: [] as string[] };

    try {
      // Fetch all due, pending, non-manual EMAIL steps (not calls)
      const { data: dueSteps } = await supabase
        .from("lead_sequences")
        .select("*")
        .lte("follow_up_date", format(new Date(), "yyyy-MM-dd"))
        .eq("status", "pending")
        .eq("manual_mode", false)
        .in("step_type", ["email_1", "email_2"])
        .neq("response_status", "cold")
        .order("follow_up_date", { ascending: true });

      if (!dueSteps || dueSteps.length === 0) {
        if (isManualTrigger) {
          toast({ title: "All caught up!", description: "No emails are due to send right now." });
        }
        setAutoSending(false);
        return;
      }

      // Fetch all lead info for these steps
      const leadIds = [...new Set(dueSteps.map((s: any) => s.lead_id))];
      const { data: leadData } = await supabase
        .from("leads")
        .select("id, company_name, contact_person, city_hub, industry, email, stage")
        .in("id", leadIds);
      const leadMap: Record<string, LeadWithSequences> = {};
      if (leadData) for (const l of leadData) leadMap[l.id] = l as LeadWithSequences;

      // Fetch all templates (fresh)
      const { data: allTemplates } = await supabase
        .from("email_templates")
        .select("*")
        .order("hub", { ascending: true });
      const tplList = (allTemplates || []) as EmailTemplate[];

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: "Auth error", description: "Not authenticated. Please re-login.", variant: "destructive" });
        setAutoSending(false);
        return;
      }

      // Process each due step
      for (const step of dueSteps as SequenceStep[]) {
        const lead = leadMap[step.lead_id];
        if (!lead) {
          results.skipped++;
          results.details.push(`⏭️ ${step.step_type} — lead not found`);
          continue;
        }
        if (!lead.email) {
          results.skipped++;
          results.details.push(`⏭️ ${lead.company_name} — no email address`);
          continue;
        }

        // Find matching template
        const hub = lead.city_hub?.toLowerCase() || "";
        const tpl = tplList.find((t) => t.hub.toLowerCase() === hub && t.step_type === step.step_type);
        if (!tpl) {
          results.skipped++;
          results.details.push(`⏭️ ${lead.company_name} — no ${step.step_type} template for hub "${lead.city_hub || 'none'}"`);
          continue;
        }

        // Send email via edge function
        try {
          const subject = replaceTemplateVars(tpl.subject, lead);
          const body = replaceTemplateVars(tpl.body, lead);
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-outreach-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ to: lead.email, subject, body, sequence_id: step.id }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);
          results.sent++;
          results.details.push(`✅ ${lead.company_name} — "${subject}" sent to ${lead.email}`);
        } catch (err: any) {
          results.failed++;
          results.details.push(`❌ ${lead.company_name} — ${err.message}`);
        }

        // Small delay between sends to avoid rate limits
        await new Promise((r) => setTimeout(r, 500));
      }

      setAutoSendResults(results);

      if (results.sent > 0) {
        toast({
          title: `🚀 Auto-Pilot: ${results.sent} email${results.sent !== 1 ? "s" : ""} sent`,
          description: results.failed > 0 ? `${results.failed} failed, ${results.skipped} skipped` : results.skipped > 0 ? `${results.skipped} skipped` : "All emails sent successfully!",
        });
      } else if (isManualTrigger) {
        toast({
          title: "No emails sent",
          description: `${results.skipped} skipped, ${results.failed} failed. Check the details banner.`,
          variant: results.failed > 0 ? "destructive" : undefined,
        });
      }

      // Refresh all data
      fetchFollowUps();
      fetchTracker();
      fetchAttention();
    } catch (err: any) {
      toast({ title: "Auto-send failed", description: err.message, variant: "destructive" });
    } finally {
      setAutoSending(false);
    }
  }, [user, fetchFollowUps, fetchTracker, fetchAttention, autoSending, today, toast]);

  // ── Run auto-send once when templates and data are loaded ──
  useEffect(() => {
    if (autoSendRan.current) return;
    if (templates.length === 0) return; // Wait for templates to load
    if (!user) return;
    autoSendRan.current = true;
    // Small delay to ensure all data is loaded
    const timer = setTimeout(() => autoSendDueEmails(false), 1500);
    return () => clearTimeout(timer);
  }, [templates, user, autoSendDueEmails]);

  const seedAnikaTemplates = async () => {
    if (!user) return;
    setSeedingTemplates(true);
    try {
      const allTemplates = getAnikaTemplates();
      const rows = allTemplates.map((t) => ({ ...t, created_by: user.id }));
      // Insert in batches of 15
      for (let i = 0; i < rows.length; i += 15) {
        const batch = rows.slice(i, i + 15);
        const { error } = await supabase.from("email_templates").insert(batch);
        if (error) throw error;
      }
      toast({ title: "✅ 45 Anika templates loaded!", description: "15 templates × 3 hubs. Ready to use." });
      fetchTemplates();
    } catch (err: any) {
      toast({ title: "Failed to seed templates", description: err.message, variant: "destructive" });
    } finally {
      setSeedingTemplates(false);
    }
  };

  const sendOutreachEmail = async (step: SequenceStep, lead: LeadWithSequences, template: EmailTemplate) => {
    if (!lead.email) {
      toast({ title: "No email address", description: `${lead.company_name} has no email set. Add one in the Pipeline first.`, variant: "destructive" });
      return;
    }
    setSendingEmail(step.id);
    try {
      const subject = replaceTemplateVars(template.subject, lead);
      const body = replaceTemplateVars(template.body, lead);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-outreach-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ to: lead.email, subject, body, sequence_id: step.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send");
      toast({ title: "📧 Email Sent!", description: `Sent "${subject}" to ${lead.email}` });
      fetchFollowUps();
      fetchTracker();
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setSendingEmail(null);
    }
  };

  // ── Helpers ──
  const daysOverdue = (date: string | null) => {
    if (!date) return 0;
    return differenceInDays(new Date(), new Date(date));
  };

  const stepBadgeColor = (status: string) => {
    if (status === "completed") return "bg-green-500/10 text-green-600 border-green-500/30";
    if (status === "skipped") return "bg-muted text-muted-foreground";
    if (status === "paused") return "bg-amber-500/10 text-amber-600 border-amber-500/30";
    return "bg-primary/10 text-primary border-primary/30";
  };

  const filteredTemplates = hubFilter === "all" ? templates : templates.filter((t) => t.hub === hubFilter);

  // Filter out cold leads from tracker
  const activeColdIds = new Set(coldLeads.map((c) => c.lead.id));
  const activeTrackerLeads = trackerLeads.filter((l) => !activeColdIds.has(l.id));

  // Auto-pilot count
  const autoPilotCount = activeTrackerLeads.filter((l) => {
    const seqs = leadSequences[l.id] || [];
    return seqs.length > 0 && !seqs.some((s) => s.manual_mode);
  }).length;

  // ── Bifurcation buttons with note popover (for Sequences & Follow-Up tabs) ──
  const BifurcationButtons = ({ step, lead }: { step: SequenceStep; lead?: LeadWithSequences }) => {
    const matchedTemplate = findTemplate(lead?.city_hub || null, step.step_type);

    return (
      <div className="space-y-2">
        {matchedTemplate && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-accent/50 border border-accent">
            <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate flex-1">
              {matchedTemplate.name}: <span className="italic">{replaceTemplateVars(matchedTemplate.subject, lead)}</span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => copyToClipboard(`Subject: ${replaceTemplateVars(matchedTemplate.subject, lead)}\n\n${replaceTemplateVars(matchedTemplate.body, lead)}`)}
            >
              <Copy className="h-3 w-3" /> Copy
            </Button>
            {lead && (step.step_type === "email_1" || step.step_type === "email_2") && (
              <Button
                size="sm"
                variant="default"
                className="h-6 px-2 text-xs gap-1"
                disabled={sendingEmail === step.id}
                onClick={() => lead && sendOutreachEmail(step, lead, matchedTemplate)}
              >
                {sendingEmail === step.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                {sendingEmail === step.id ? "Sending..." : "Send Email"}
              </Button>
            )}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <BifurcationAction label="No Response" icon={<Clock className="h-3 w-3" />} variant="outline" onConfirm={(note) => handleNoResponse(step, note)} />
          <BifurcationAction label="Replied" icon={<CheckCircle className="h-3 w-3" />} variant="outline" className="border-green-500/50 text-green-600 hover:bg-green-500/10" onConfirm={(note) => handleReplied(step, note)} />
          <BifurcationAction label="Interested in Call" icon={<PhoneCall className="h-3 w-3" />} variant="outline" className="border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10" onConfirm={(note) => handleInterestedCall(step, note)} />
        </div>
        {step.note && (
          <p className="text-xs text-muted-foreground italic pl-1">📝 {step.note}</p>
        )}
      </div>
    );
  };

  // ── Bifurcation Action with Note Popover ──
  const BifurcationAction = ({
    label, icon, variant, className: cls, onConfirm,
  }: {
    label: string;
    icon: React.ReactNode;
    variant: "outline" | "default";
    className?: string;
    onConfirm: (note?: string) => void;
  }) => {
    const [localNote, setLocalNote] = useState("");
    const [open, setOpen] = useState(false);
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant={variant} className={`gap-1.5 text-xs ${cls || ""}`}>
            {icon} {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-2" align="start">
          <p className="text-xs font-medium">{label}</p>
          <Textarea
            placeholder="Add a note (optional)..."
            value={localNote}
            onChange={(e) => setLocalNote(e.target.value)}
            rows={2}
            className="text-xs"
          />
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              onConfirm(localNote || undefined);
              setLocalNote("");
              setOpen(false);
            }}
          >
            Confirm
          </Button>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="space-y-4 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Anika Outreach Engine</h1>
          <p className="text-muted-foreground text-sm mt-1">Automated outreach sequences & lead management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={autoSending}
            onClick={() => autoSendDueEmails(true)}
          >
            {autoSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {autoSending ? "Sending..." : "Run Auto-Pilot"}
          </Button>
          {isOwner && (
            <Button variant="outline" size="icon" onClick={() => { setSettingsForm(settings); setShowSettings(true); }}>
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Auto-Send Results Banner */}
      {autoSendResults && (
        <Card className={`border-l-4 ${autoSendResults.failed > 0 ? "border-l-red-500 bg-red-500/5" :
          autoSendResults.sent > 0 ? "border-l-green-500 bg-green-500/5" :
            "border-l-amber-500 bg-amber-500/5"
          }`}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {autoSendResults.sent > 0 && <Badge className="bg-green-500 text-white text-[10px]">✅ {autoSendResults.sent} sent</Badge>}
                  {autoSendResults.skipped > 0 && <Badge variant="outline" className="text-[10px]">⏭️ {autoSendResults.skipped} skipped</Badge>}
                  {autoSendResults.failed > 0 && <Badge variant="destructive" className="text-[10px]">❌ {autoSendResults.failed} failed</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">Auto-Pilot completed</span>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setAutoSendResults(null)}>Dismiss</Button>
            </div>
            {autoSendResults.details.length > 0 && (
              <Collapsible className="mt-2">
                <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" /> View details
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground pl-4">
                    {autoSendResults.details.map((d, i) => <p key={i}>{d}</p>)}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="sequences">
        <TabsList>
          <TabsTrigger value="sequences" className="gap-1.5">
            <Play className="h-3.5 w-3.5" /> Sequences
          </TabsTrigger>
          <TabsTrigger value="attention" className="gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Needs Attention
            {attentionSteps.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{attentionSteps.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="follow-up" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Follow-Up Today
            {followUps.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{followUps.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Template Library
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: Sequences (Auto-Pilot) ── */}
        <TabsContent value="sequences">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground font-medium">
              {autoPilotCount} lead{autoPilotCount !== 1 ? "s" : ""} in Auto-Pilot
            </p>
          </div>
          <DecisionTree />
          {activeTrackerLeads.length === 0 && coldLeads.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <p className="font-medium">No leads in "New Lead" stage</p>
              <p className="text-sm">Add leads from the Growth Pipeline to start sequences.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {activeTrackerLeads.map((lead) => {
                const seqs = leadSequences[lead.id] || [];
                const hasSequence = seqs.length > 0;
                const isInterested = seqs.some((s) => s.response_status === "interested_call");
                const exhausted = isSequenceExhausted(seqs);
                const isManual = seqs.some((s) => s.manual_mode);
                return (
                  <Collapsible key={lead.id} open={expandedLead === lead.id} onOpenChange={(open) => setExpandedLead(open ? lead.id : null)}>
                    <Card className={`transition-all ${isInterested ? "border-l-4 border-l-green-500" : ""}`}>
                      <CollapsibleTrigger className="w-full">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-semibold text-sm text-left">{lead.company_name}</p>
                              <p className="text-xs text-muted-foreground">{lead.contact_person} · {lead.city_hub || "No Hub"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {hasSequence && (
                              isManual ? (
                                <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/30 text-[10px]">
                                  <Hand className="h-3 w-3 mr-1" /> Manual
                                </Badge>
                              ) : (
                                <SequenceProgressBar steps={seqs} />
                              )
                            )}
                            {!hasSequence && (
                              <Badge variant="outline" className="text-xs text-muted-foreground">No sequence</Badge>
                            )}
                            {hasSequence && (
                              <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                                <Switch
                                  checked={isManual}
                                  onCheckedChange={(checked) => toggleManualMode(lead.id, checked)}
                                  className="scale-75"
                                />
                              </div>
                            )}
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                          </div>
                        </CardContent>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-3 border-t pt-3">
                          {hasSequence ? (
                            <div className="space-y-3">
                              {seqs.map((step, i) => (
                                <div key={step.id} className="flex items-start gap-3">
                                  <div className="flex flex-col items-center">
                                    <div className={`p-1.5 rounded-full ${stepBadgeColor(step.status)}`}>
                                      {STEP_ICONS[step.step_type] || <Mail className="h-3 w-3" />}
                                    </div>
                                    {i < seqs.length - 1 && <div className="w-px h-6 bg-border" />}
                                  </div>
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="text-sm font-medium">{STEP_LABELS[step.step_type] || step.step_type}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {step.status === "completed" && step.sent_at ? `Sent ${format(new Date(step.sent_at), "MMM d")}` :
                                            step.follow_up_date ? `Due ${format(new Date(step.follow_up_date), "MMM d")}` : "No date"}
                                        </p>
                                      </div>
                                      <Badge variant="outline" className={`text-[10px] ${stepBadgeColor(step.status)}`}>
                                        {step.status}
                                      </Badge>
                                    </div>
                                    {step.status === "pending" && <BifurcationButtons step={step} lead={lead} />}
                                    {step.note && step.status !== "pending" && (
                                      <p className="text-xs text-muted-foreground italic">📝 {step.note}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {exhausted && (
                                <div className="flex gap-2 pt-2 border-t">
                                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => restartSequence(lead.id)}>
                                    <RotateCcw className="h-3 w-3" /> Restart Sequence
                                  </Button>
                                  <Button size="sm" variant="outline" className="gap-1.5 text-xs text-blue-600 border-blue-500/50 hover:bg-blue-500/10" onClick={() => markCold(lead.id, seqs)}>
                                    <Snowflake className="h-3 w-3" /> Mark Cold
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-3">
                              <Button size="sm" onClick={() => startSequence(lead.id)} className="gap-1.5">
                                <Play className="h-3.5 w-3.5" /> Start Sequence
                              </Button>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}

              {/* Cold Leads Section */}
              {coldLeads.length > 0 && (
                <Collapsible open={showCold} onOpenChange={setShowCold}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center gap-2 py-2 px-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {showCold ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <Snowflake className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Cold Leads ({coldLeads.length})</span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 mt-1">
                      {coldLeads.map(({ lead }) => (
                        <Card key={lead.id} className="border-blue-500/20 bg-blue-500/5">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-sm">{lead.company_name}</p>
                              <p className="text-xs text-muted-foreground">{lead.contact_person} · {lead.city_hub || "No Hub"}</p>
                            </div>
                            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => reviveLead(lead.id)}>
                              <RotateCcw className="h-3 w-3" /> Revive
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── TAB 2: Needs Attention ── */}
        <TabsContent value="attention">
          {attentionSteps.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-500" />
              <p className="font-medium">No leads need attention</p>
              <p className="text-sm">All replied leads have been actioned.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {attentionSteps.map((step) => {
                const lead = attentionLeads[step.lead_id];
                return (
                  <Card key={step.id} className="border-l-4 border-l-amber-500">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{lead?.company_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            {lead?.contact_person} · {lead?.city_hub || "No Hub"} · {lead?.industry || "N/A"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{STEP_LABELS[step.step_type] || step.step_type}</Badge>
                          <Badge className={step.response_status === "replied" ? "bg-green-500 text-white text-xs" : "bg-emerald-500 text-white text-xs"}>
                            {step.response_status === "replied" ? "Replied" : "Wants Call"}
                          </Badge>
                        </div>
                      </div>
                      {step.note && (
                        <p className="text-xs text-muted-foreground italic">📝 {step.note}</p>
                      )}
                      {/* 3 Big Action Buttons */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <Button
                          size="sm"
                          className="gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleScheduleCall(step)}
                        >
                          <Calendar className="h-3.5 w-3.5" /> Interested - Schedule Call
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                          onClick={() => handleNurture30d(step)}
                        >
                          <Clock className="h-3.5 w-3.5" /> Not Now - Nurture
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs border-blue-500/50 text-blue-600 hover:bg-blue-500/10"
                          onClick={() => handleOperationalReview(step)}
                        >
                          <Wrench className="h-3.5 w-3.5" /> Operational Review
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── TAB 3: Follow-Up Today ── */}
        <TabsContent value="follow-up">
          {followUps.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-500" />
              <p className="font-medium">All caught up!</p>
              <p className="text-sm">No follow-ups due today.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {followUps.map((step) => {
                const lead = followUpLeads[step.lead_id];
                const overdue = daysOverdue(step.follow_up_date);
                const isInterested = step.response_status === "interested_call";
                return (
                  <Card key={step.id} className={`transition-all ${isInterested ? "border-l-4 border-l-green-500" : ""}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${stepBadgeColor(step.status)}`}>
                            {STEP_ICONS[step.step_type] || <Mail className="h-3.5 w-3.5" />}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{lead?.company_name || "Unknown Lead"}</p>
                            <p className="text-xs text-muted-foreground">{lead?.contact_person} · {lead?.city_hub || "No Hub"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{STEP_LABELS[step.step_type] || step.step_type}</Badge>
                          {overdue > 0 && (
                            <Badge variant="destructive" className="text-xs">{overdue}d overdue</Badge>
                          )}
                          {isInterested && (
                            <Badge className="bg-green-500 text-white text-xs">🟢 Wants Call</Badge>
                          )}
                        </div>
                      </div>
                      <BifurcationButtons step={step} lead={lead} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── TAB 4: Template Library ── */}
        <TabsContent value="templates">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1">
              <Button variant={hubFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setHubFilter("all")}>All</Button>
              {HUBS.map((h) => (
                <Button key={h} variant={hubFilter === h ? "default" : "outline"} size="sm" onClick={() => setHubFilter(h)}>{HUB_LABELS[h] || h}</Button>
              ))}
            </div>
            <div className="flex gap-2">
              {templates.length === 0 && (
                <Button size="sm" variant="outline" onClick={seedAnikaTemplates} disabled={seedingTemplates} className="gap-1.5">
                  {seedingTemplates ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {seedingTemplates ? "Loading..." : "Load Anika Templates"}
                </Button>
              )}
              <Button size="sm" onClick={() => { setEditTemplate(null); setShowTemplateForm(true); }} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New Template
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Use <code className="bg-muted px-1 rounded">[Name]</code>, <code className="bg-muted px-1 rounded">[Company]</code>, <code className="bg-muted px-1 rounded">[City Hub]</code>, <code className="bg-muted px-1 rounded">[Industry]</code> as dynamic variables.
          </p>

          {filteredTemplates.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <Mail className="h-10 w-10 mx-auto mb-3" />
              <p className="font-medium">No templates yet</p>
              <p className="text-sm">
                Create your first email template to get started.
              </p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((t) => (
                <Card key={t.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setExpandedTemplate(expandedTemplate === t.id ? null : t.id)}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t.subject}</p>
                      </div>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-[10px]">{HUB_LABELS[t.hub] || t.hub}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{STEP_LABELS[t.step_type] || t.step_type}</Badge>
                      </div>
                    </div>
                    {expandedTemplate === t.id && (
                      <div className="pt-2 border-t space-y-3">
                        <p className="text-sm whitespace-pre-wrap">{t.body}</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); copyToClipboard(`Subject: ${t.subject}\n\n${t.body}`); }} className="gap-1.5">
                            <Copy className="h-3 w-3" /> Copy
                          </Button>
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditTemplate(t); setShowTemplateForm(true); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }} className="text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Template Form Dialog */}
      <Dialog open={showTemplateForm} onOpenChange={() => { setShowTemplateForm(false); setEditTemplate(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTemplate ? "Edit Template" : "New Template"}</DialogTitle>
            <DialogDescription>Create email templates for your dispatchers. Use [Name], [Company], [City Hub], [Industry] as variables.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTemplateSave} className="space-y-3">
            <div>
              <Label>Template Name</Label>
              <Input name="name" defaultValue={editTemplate?.name ?? ""} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Hub</Label>
                <Select name="hub" defaultValue={editTemplate?.hub ?? "atlanta"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HUBS.map((h) => <SelectItem key={h} value={h}>{HUB_LABELS[h] || h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Step Type</Label>
                <Select name="step_type" defaultValue={editTemplate?.step_type ?? "email_1"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email_1">Day 1 - Introduction</SelectItem>
                    <SelectItem value="email_2">Day 4 - Social Proof</SelectItem>
                    <SelectItem value="call">Day 8 - Low Friction Offer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Subject Line</Label>
              <Input name="subject" defaultValue={editTemplate?.subject ?? ""} required />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea name="body" defaultValue={editTemplate?.body ?? ""} required rows={6} />
            </div>
            <DialogFooter>
              <Button type="submit">{editTemplate ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sequence Settings</DialogTitle>
            <DialogDescription>Configure the cadence for outreach sequences.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Days: Day 1 → Day 4 (Introduction → Social Proof)</Label>
              <Input type="number" min={1} max={30} value={settingsForm.email1_to_email2_days} onChange={(e) => setSettingsForm((p) => ({ ...p, email1_to_email2_days: parseInt(e.target.value) || 3 }))} />
            </div>
            <div>
              <Label className="text-xs">Days: Day 4 → Day 8 (Social Proof → Low Friction Offer)</Label>
              <Input type="number" min={1} max={30} value={settingsForm.email2_to_call_days} onChange={(e) => setSettingsForm((p) => ({ ...p, email2_to_call_days: parseInt(e.target.value) || 4 }))} />
            </div>
            <div>
              <Label className="text-xs">Days: "No Response" snooze</Label>
              <Input type="number" min={1} max={30} value={settingsForm.no_response_snooze_days} onChange={(e) => setSettingsForm((p) => ({ ...p, no_response_snooze_days: parseInt(e.target.value) || 3 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveSettings}>Save Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
