import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { LEAD_STAGES, CITY_HUBS, INDUSTRIES, ACTION_ZONE_CITIES, SERVICE_TYPES, VEHICLE_TYPES } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Plus, Package, AlertTriangle,
  Pencil, Trash2, Search, Crosshair, CalendarIcon, Truck,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import LeadDetailPanel from "@/components/LeadDetailPanel";

type Lead = {
  id: string;
  company_name: string;
  contact_person: string;
  phone: string | null;
  email: string | null;
  main_lanes: string | null;
  estimated_monthly_loads: number | null;
  stage: string;
  next_action_date: string | null;
  created_at: string;
  city_hub: string | null;
  industry: string | null;
  delivery_points: string | null;
  service_type: string | null;
  avg_packages_day: number | null;
  delivery_radius_miles: number | null;
  vehicle_type: string | null;
  sla_requirement: string | null;
};

const getIndustryInfo = (value: string | null) => INDUSTRIES.find((i) => i.value === value);
const getCityLabel = (value: string | null) => CITY_HUBS.find((c) => c.value === value)?.label;
const getServiceLabel = (value: string | null) => SERVICE_TYPES.find((s) => s.value === value)?.label;

const checkActionZone = (deliveryPoints: string | null, cityHub: string | null): "in_zone" | "out_zone" | "no_data" => {
  if (!deliveryPoints) return "no_data";
  const text = deliveryPoints.toLowerCase();
  const hubsToCheck = cityHub ? [cityHub, ...Object.keys(ACTION_ZONE_CITIES).filter(h => h !== cityHub)] : Object.keys(ACTION_ZONE_CITIES);
  for (const hub of hubsToCheck) {
    const cities = ACTION_ZONE_CITIES[hub];
    if (cities?.some((city) => text.includes(city))) return "in_zone";
  }
  return "out_zone";
};

const getDaysSinceContact = (leadId: string, lastContactMap: Record<string, string>): number | null => {
  const last = lastContactMap[leadId];
  if (!last) return null;
  return Math.floor((Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24));
};

// Stage gradient colors from navy to orange
const STAGE_TOP_COLORS = [
  "hsl(213, 100%, 14%)",
  "hsl(213, 80%, 25%)",
  "hsl(213, 60%, 35%)",
  "hsl(30, 60%, 45%)",
  "hsl(30, 80%, 50%)",
  "hsl(30, 100%, 50%)",
  "hsl(30, 100%, 55%)",
];

export default function Pipeline() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [lastContactMap, setLastContactMap] = useState<Record<string, string>>({});
  const [nextActionDate, setNextActionDate] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchLeads = useCallback(async () => {
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(500);
    if (data) setLeads(data as Lead[]);
    setLoading(false);
  }, []);

  const fetchLastContacts = useCallback(async () => {
    const { data } = await supabase.rpc("get_last_contacts");
    if (!data) {
      const { data: interactions } = await supabase
        .from("lead_interactions")
        .select("lead_id, created_at")
        .order("created_at", { ascending: false });
      if (interactions) {
        const map: Record<string, string> = {};
        for (const i of interactions) {
          if (!map[i.lead_id]) map[i.lead_id] = i.created_at;
        }
        setLastContactMap(map);
      }
      return;
    }
    const map: Record<string, string> = {};
    for (const row of data) {
      map[row.lead_id] = row.last_contact;
    }
    setLastContactMap(map);
  }, []);

  useEffect(() => { fetchLeads(); fetchLastContacts(); }, [fetchLeads, fetchLastContacts]);

  useEffect(() => {
    const channel = supabase
      .channel("leads-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchLeads())
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_interactions" }, () => fetchLastContacts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLeads, fetchLastContacts]);

  const openLead = (lead: Lead) => {
    setSelectedLead(lead);
  };

  const handleDrop = async (stage: string) => {
    if (!draggedId) return;
    await supabase.from("leads").update({ stage: stage as Database["public"]["Enums"]["lead_stage"] }).eq("id", draggedId);
    setDraggedId(null);
    fetchLeads();
  };

  // Reset date picker when opening form
  useEffect(() => {
    if (showAdd) setNextActionDate(undefined);
    if (editLead?.next_action_date) {
      setNextActionDate(new Date(editLead.next_action_date + "T00:00:00"));
    }
  }, [showAdd, editLead]);

  const PHONE_REGEX = /^[+]?[\d\s()-]*$/;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);

    // Validate
    const errors: Record<string, string> = {};
    const companyName = (fd.get("company_name") as string || "").trim();
    const contactPerson = (fd.get("contact_person") as string || "").trim();
    const phone = (fd.get("phone") as string || "").trim();
    const email = (fd.get("email") as string || "").trim();

    if (!companyName) errors.company_name = "Company name is required";
    if (!contactPerson) errors.contact_person = "Contact person is required";
    if (phone && !PHONE_REGEX.test(phone)) errors.phone = "Invalid phone number";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Invalid email address";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    const payload: any = {
      company_name: companyName,
      contact_person: contactPerson,
      phone: phone || null,
      email: email || null,
      estimated_monthly_loads: Number(fd.get("loads")) || null,
      next_action_date: nextActionDate ? format(nextActionDate, "yyyy-MM-dd") : null,
      city_hub: fd.get("city_hub") as string || null,
      industry: fd.get("industry") as string || null,
      delivery_points: fd.get("delivery_points") as string || null,
      service_type: fd.get("service_type") as string || null,
      avg_packages_day: Number(fd.get("avg_packages_day")) || null,
      delivery_radius_miles: Number(fd.get("delivery_radius_miles")) || null,
      vehicle_type: fd.get("vehicle_type") as string || null,
      sla_requirement: fd.get("sla_requirement") as string || null,
    };

    if (editLead) {
      const { error } = await supabase.from("leads").update(payload).eq("id", editLead.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { setEditLead(null); fetchLeads(); }
    } else {
      const { error } = await supabase.from("leads").insert({ ...payload, created_by: user.id });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { setShowAdd(false); fetchLeads(); }
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("leads").delete().eq("id", deleteId);
    setDeleteId(null);
    if (selectedLead?.id === deleteId) setSelectedLead(null);
    fetchLeads();
  };

  const isOverdue = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date(new Date().toISOString().split("T")[0]);
  };

  const filtered = leads.filter((l) => {
    if (search && !l.company_name.toLowerCase().includes(search.toLowerCase()) && !l.contact_person.toLowerCase().includes(search.toLowerCase())) return false;
    if (cityFilter !== "all" && l.city_hub !== cityFilter) return false;
    if (industryFilter !== "all" && l.industry !== industryFilter) return false;
    return true;
  });

  const isFormOpen = showAdd || !!editLead;

  // Skeleton loading
  if (loading) {
    return (
      <div className="space-y-4 animate-in">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 shimmer" />
            <Skeleton className="h-4 w-64 mt-2 shimmer" />
          </div>
          <Skeleton className="h-10 w-28 shimmer" />
        </div>
        <div className="flex gap-4 min-h-[60vh] overflow-x-auto pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-muted/40 rounded-2xl p-3 min-w-[230px] flex-1 space-y-3">
              <Skeleton className="h-5 w-24 shimmer" />
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-28 w-full rounded-xl shimmer" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isGhosting = (leadId: string) => {
    const days = getDaysSinceContact(leadId, lastContactMap);
    if (days === null) {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return false;
      const leadAge = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24));
      return leadAge > 10;
    }
    return days > 10;
  };

  const ghostingDays = (leadId: string) => {
    const days = getDaysSinceContact(leadId, lastContactMap);
    if (days !== null) return days;
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return 0;
    return Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-4 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Growth Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and manage your prospecting leads</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2 btn-gradient">
          <Plus className="h-4 w-4" /> New Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          <Button variant={cityFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setCityFilter("all")}>All</Button>
          {CITY_HUBS.map((c) => (
            <Button key={c.value} variant={cityFilter === c.value ? "default" : "outline"} size="sm" onClick={() => setCityFilter(c.value)}>
              {c.label}
            </Button>
          ))}
        </div>
        <Select value={industryFilter} onValueChange={setIndustryFilter}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Industries</SelectItem>
            {INDUSTRIES.map((i) => (
              <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 min-h-[60vh] overflow-x-auto pb-4">
        {LEAD_STAGES.map((stage, stageIdx) => (
          <div
            key={stage.value}
            className="bg-muted/40 rounded-2xl p-3 flex flex-col min-w-[230px] flex-1 transition-colors glass-card"
            style={{ borderTop: `3px solid ${STAGE_TOP_COLORS[stageIdx % STAGE_TOP_COLORS.length]}` }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(stage.value)}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: STAGE_TOP_COLORS[stageIdx % STAGE_TOP_COLORS.length] }}
                />
                <h3 className="text-sm font-semibold text-foreground/80">{stage.label}</h3>
              </div>
              <Badge variant="secondary" className="text-xs rounded-full px-2">
                {filtered.filter((l) => l.stage === stage.value).length}
              </Badge>
            </div>
            <div className="space-y-2 flex-1">
              {filtered
                .filter((l) => l.stage === stage.value)
                .map((lead) => {
                  const ghosting = isGhosting(lead.id);
                  const industryInfo = getIndustryInfo(lead.industry);
                  const cityLabel = getCityLabel(lead.city_hub);
                  const serviceLabel = getServiceLabel(lead.service_type);
                  return (
                    <Card
                      key={lead.id}
                      className={`group cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border-l-4 rounded-xl ${ghosting ? "border-l-accent animate-[shake_0.5s_ease-in-out_infinite]" : "border-l-accent/30"
                        }`}
                      draggable
                      onDragStart={() => setDraggedId(lead.id)}
                      onClick={() => openLead(lead)}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <p className="font-semibold text-sm leading-tight">{lead.company_name}</p>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); setEditLead(lead); }} className="p-1 rounded hover:bg-muted">
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setDeleteId(lead.id); }} className="p-1 rounded hover:bg-destructive/10">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{lead.contact_person}</p>
                        <div className="flex flex-wrap gap-1">
                          {cityLabel && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{cityLabel}</Badge>}
                          {industryInfo && (
                            <Badge className={`text-[10px] px-1.5 py-0 text-white ${industryInfo.color}`}>
                              {industryInfo.label}
                            </Badge>
                          )}
                          {serviceLabel && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-accent/50 text-accent">
                              <Truck className="h-2.5 w-2.5 mr-0.5" />{serviceLabel}
                            </Badge>
                          )}
                        </div>
                        {lead.estimated_monthly_loads && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Package className="h-3 w-3" /> {lead.estimated_monthly_loads} loads/mo
                          </div>
                        )}
                        {lead.next_action_date && (
                          <div className={`flex items-center gap-1 text-xs font-medium ${isOverdue(lead.next_action_date) ? "text-red-500" : "text-muted-foreground"}`}>
                            <AlertTriangle className={`h-3 w-3 ${isOverdue(lead.next_action_date) ? "text-red-500" : ""}`} />
                            {lead.next_action_date}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          {lead.delivery_points && (() => {
                            const zone = checkActionZone(lead.delivery_points, lead.city_hub);
                            return (
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${zone === "in_zone" ? "border-green-500 text-green-600" : "border-red-500 text-red-600"}`}>
                                <Crosshair className="h-2.5 w-2.5 mr-0.5" />
                                {zone === "in_zone" ? "In Zone" : "Out of Zone"}
                              </Badge>
                            );
                          })()}
                          {ghosting && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-accent text-accent-foreground">
                              ? {ghostingDays(lead.id)}d no contact
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Lead Dialog */}
      <Dialog open={isFormOpen} onOpenChange={() => { setShowAdd(false); setEditLead(null); setFormErrors({}); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editLead ? "Edit Lead" : "Add New Lead"}</DialogTitle>
            <DialogDescription>{editLead ? "Update the lead details." : "Fill in the lead information."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Contact Information */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact Information</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Company Name *</Label>
                  <Input name="company_name" defaultValue={editLead?.company_name ?? ""} required />
                  {formErrors.company_name && <p className="text-xs text-destructive mt-1">{formErrors.company_name}</p>}
                </div>
                <div>
                  <Label>Contact Person *</Label>
                  <Input name="contact_person" defaultValue={editLead?.contact_person ?? ""} required />
                  {formErrors.contact_person && <p className="text-xs text-destructive mt-1">{formErrors.contact_person}</p>}
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input name="phone" defaultValue={editLead?.phone ?? ""} />
                  {formErrors.phone && <p className="text-xs text-destructive mt-1">{formErrors.phone}</p>}
                </div>
                <div>
                  <Label>Email</Label>
                  <Input name="email" type="email" defaultValue={editLead?.email ?? ""} />
                  {formErrors.email && <p className="text-xs text-destructive mt-1">{formErrors.email}</p>}
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Delivery Metrics */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Delivery Metrics</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Service Type</Label>
                  <select name="service_type" defaultValue={editLead?.service_type ?? ""} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {SERVICE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div><Label>Avg. Packages/Day</Label><Input name="avg_packages_day" type="number" defaultValue={editLead?.avg_packages_day ?? ""} placeholder="e.g. 150" /></div>
                <div><Label>Delivery Radius (miles)</Label><Input name="delivery_radius_miles" type="number" defaultValue={editLead?.delivery_radius_miles ?? ""} placeholder="e.g. 50" /></div>
                <div>
                  <Label>Vehicle Type Required</Label>
                  <select name="vehicle_type" defaultValue={editLead?.vehicle_type ?? ""} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select...</option>
                    {VEHICLE_TYPES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                </div>
                <div><Label>SLA Requirement</Label><Input name="sla_requirement" defaultValue={editLead?.sla_requirement ?? ""} placeholder="e.g. Same-day by 5pm" /></div>
                <div><Label>Est. Monthly Loads</Label><Input name="loads" type="number" defaultValue={editLead?.estimated_monthly_loads ?? ""} /></div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Location & Scheduling */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Location & Scheduling</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>City Hub</Label>
                  <select name="city_hub" defaultValue={editLead?.city_hub ?? ""} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">None</option>
                    {CITY_HUBS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Industry</Label>
                  <select name="industry" defaultValue={editLead?.industry ?? ""} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">None</option>
                    {INDUSTRIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <Label>Next Action Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !nextActionDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {nextActionDate ? format(nextActionDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={nextActionDate}
                      onSelect={setNextActionDate}
                      disabled={(date) => date < new Date(new Date().toISOString().split("T")[0])}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="mt-3"><Label>Delivery Points</Label><Textarea name="delivery_points" defaultValue={editLead?.delivery_points ?? ""} placeholder="e.g. Fort Lauderdale, Orlando, Tampa" className="text-sm" /></div>
            </div>

            <DialogFooter><Button type="submit">{editLead ? "Save Changes" : "Add Lead"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lead Detail CRM Panel */}
      <LeadDetailPanel
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        onLeadUpdated={() => { fetchLeads(); fetchLastContacts(); }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lead?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the lead and all its interactions.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
