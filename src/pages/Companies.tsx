// ═══════════════════════════════════════════════════════════
// COMPANIES — Client CRM with load history & contact detail
// ═══════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Plus, Search, Pencil, Trash2, Building2, Phone,
  Globe, MapPin, Package, DollarSign, Users, X, ExternalLink,
  TrendingUp, Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────
type Company = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  created_at: string;
};

type Load = {
  id: string;
  load_date: string;
  reference_number: string | null;
  status: string;
  revenue: number;
  miles: number;
  client_name: string | null;
};

type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  phone: string | null;
  email: string | null;
  company_id: string | null;
};

type LoadSummary = { count: number; revenue: number };

// ─── Helpers ────────────────────────────────────────────
const fmtRevenue = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const STATUS_COLORS: Record<string, string> = {
  delivered: "bg-emerald-500/15 text-emerald-400",
  "in-transit": "bg-blue-500/15 text-blue-400",
  pending: "bg-yellow-500/15 text-yellow-400",
  cancelled: "bg-red-500/15 text-red-400",
};

// ─── Company Form ────────────────────────────────────────
function CompanyForm({
  initial,
  onSubmit,
}: {
  initial?: Company | null;
  onSubmit: (payload: Partial<Company>) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    await onSubmit({
      name: fd.get("name") as string,
      industry: (fd.get("industry") as string) || null,
      phone: (fd.get("phone") as string) || null,
      address: (fd.get("address") as string) || null,
      city: (fd.get("city") as string) || null,
      state: (fd.get("state") as string) || null,
      website: (fd.get("website") as string) || null,
      notes: (fd.get("notes") as string) || null,
    });
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label>Company Name *</Label>
        <Input name="name" defaultValue={initial?.name ?? ""} required placeholder="Acme Corp" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Industry</Label>
          <Input name="industry" defaultValue={initial?.industry ?? ""} placeholder="Logistics" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input name="phone" defaultValue={initial?.phone ?? ""} placeholder="+1 (555) 000-0000" />
        </div>
      </div>
      <div>
        <Label>Address</Label>
        <Input name="address" defaultValue={initial?.address ?? ""} placeholder="123 Main St" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>City</Label>
          <Input name="city" defaultValue={initial?.city ?? ""} placeholder="Phoenix" />
        </div>
        <div>
          <Label>State</Label>
          <Input name="state" defaultValue={initial?.state ?? ""} placeholder="AZ" />
        </div>
      </div>
      <div>
        <Label>Website</Label>
        <Input name="website" defaultValue={initial?.website ?? ""} placeholder="https://" />
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea name="notes" defaultValue={initial?.notes ?? ""} rows={3} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={loading} className="btn-gradient">
          {loading ? "Saving…" : initial ? "Save Changes" : "Add Company"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ─── Company Detail Slide-Over ────────────────────────────
function CompanyDetail({
  company,
  open,
  onClose,
  onEdit,
}: {
  company: Company | null;
  open: boolean;
  onClose: () => void;
  onEdit: (c: Company) => void;
}) {
  const [loads, setLoads] = useState<Load[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!company || !open) return;
    setLoadingDetail(true);
    Promise.all([
      supabase
        .from("daily_loads")
        .select("id,load_date,reference_number,status,revenue,miles,client_name")
        .eq("client_name", company.name)
        .order("load_date", { ascending: false })
        .limit(50),
      supabase
        .from("contacts")
        .select("id,first_name,last_name,job_title,phone,email,company_id")
        .eq("company_id", company.id),
    ]).then(([loadsRes, contactsRes]) => {
      setLoads((loadsRes.data as Load[]) ?? []);
      setContacts((contactsRes.data as Contact[]) ?? []);
      setLoadingDetail(false);
    });
  }, [company, open]);

  if (!company) return null;

  const totalRevenue = loads.reduce((s, l) => s + (l.revenue ?? 0), 0);
  const lastLoadDate = loads[0]?.load_date ?? null;
  const activeLoads = loads.filter((l) =>
    ["pending", "in-transit", "assigned"].includes(l.status)
  ).length;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0" side="right">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b px-6 py-4 flex items-start justify-between">
          <div>
            <SheetHeader>
              <SheetTitle className="text-xl font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-accent" />
                {company.name}
              </SheetTitle>
              <SheetDescription>
                {[company.city, company.state].filter(Boolean).join(", ") || "No location set"}
              </SheetDescription>
            </SheetHeader>
          </div>
          <div className="flex gap-2 mt-1">
            <Button size="sm" variant="outline" onClick={() => onEdit(company)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-muted/30">
              <CardContent className="p-3 text-center">
                <Package className="h-4 w-4 mx-auto mb-1 text-accent" />
                <div className="text-2xl font-bold">{loads.length}</div>
                <div className="text-xs text-muted-foreground">Total Loads</div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-3 text-center">
                <DollarSign className="h-4 w-4 mx-auto mb-1 text-emerald-400" />
                <div className="text-2xl font-bold">{fmtRevenue(totalRevenue)}</div>
                <div className="text-xs text-muted-foreground">Total Revenue</div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-3 text-center">
                <TrendingUp className="h-4 w-4 mx-auto mb-1 text-blue-400" />
                <div className="text-2xl font-bold">{activeLoads}</div>
                <div className="text-xs text-muted-foreground">Active Loads</div>
              </CardContent>
            </Card>
          </div>

          {/* Company Info */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Company Info
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2 text-sm">
              {company.industry && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  {company.industry}
                </div>
              )}
              {company.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <a href={`tel:${company.phone}`} className="hover:text-foreground">{company.phone}</a>
                </div>
              )}
              {company.address && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {[company.address, company.city, company.state].filter(Boolean).join(", ")}
                </div>
              )}
              {company.website && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  <a href={company.website} target="_blank" rel="noreferrer" className="hover:text-accent flex items-center gap-1">
                    {company.website} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {lastLoadDate && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Last load: {new Date(lastLoadDate).toLocaleDateString()}
                </div>
              )}
              {company.notes && (
                <div className="mt-2 p-2 rounded bg-muted/40 text-xs text-muted-foreground">
                  {company.notes}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contacts */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Users className="h-3.5 w-3.5" /> Contacts ({contacts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loadingDetail ? (
                <Skeleton className="h-8 w-full" />
              ) : contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contacts linked to this company.</p>
              ) : (
                <div className="space-y-2">
                  {contacts.map((ct) => (
                    <div key={ct.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                      <div>
                        <div className="font-medium">{ct.first_name} {ct.last_name}</div>
                        {ct.job_title && <div className="text-xs text-muted-foreground">{ct.job_title}</div>}
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {ct.phone && <div>{ct.phone}</div>}
                        {ct.email && <div>{ct.email}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Load History */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Package className="h-3.5 w-3.5" /> Load History ({loads.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {loadingDetail ? (
                <div className="px-4 pb-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : loads.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">No loads found for this client.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Ref #</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loads.map((l) => (
                      <TableRow key={l.id} className="text-sm">
                        <TableCell className="py-2">
                          {new Date(l.load_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="py-2 font-mono text-xs">
                          {l.reference_number ?? "—"}
                        </TableCell>
                        <TableCell className="py-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[l.status] ?? "bg-muted text-muted-foreground"}`}>
                            {l.status}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right text-emerald-400 font-medium">
                          {fmtRevenue(l.revenue ?? 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadStats, setLoadStats] = useState<Record<string, LoadSummary>>({});
  const [showForm, setShowForm] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailCompany, setDetailCompany] = useState<Company | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchCompanies = useCallback(async () => {
    const { data } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      const typed = data as Company[];
      setCompanies(typed);
      if (typed.length > 0) {
        const names = typed.map((c) => c.name);
        const { data: loads } = await supabase
          .from("daily_loads")
          .select("client_name,revenue,status")
          .in("client_name", names);
        if (loads) {
          const stats: Record<string, LoadSummary> = {};
          for (const l of loads) {
            if (!l.client_name) continue;
            if (!stats[l.client_name]) stats[l.client_name] = { count: 0, revenue: 0 };
            stats[l.client_name].count++;
            stats[l.client_name].revenue += l.revenue ?? 0;
          }
          setLoadStats(stats);
        }
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  useEffect(() => {
    const ch = supabase
      .channel("companies-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "companies" }, fetchCompanies)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchCompanies]);

  const handleSubmit = async (payload: Partial<Company>) => {
    if (!user) return;
    if (editCompany) {
      const { error } = await supabase.from("companies").update(payload).eq("id", editCompany.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Company updated" });
        setEditCompany(null);
        setShowForm(false);
        fetchCompanies();
      }
    } else {
      const { error } = await supabase.from("companies").insert({ ...payload, created_by: user.id });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Company added" });
        setShowForm(false);
        fetchCompanies();
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("companies").delete().eq("id", deleteId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Company deleted" });
    setDeleteId(null);
    fetchCompanies();
  };

  const filtered = companies.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.city ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.state ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.industry ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const isFormOpen = showForm || !!editCompany;

  return (
    <div className="space-y-4 animate-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Companies</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {companies.length} client{companies.length !== 1 ? "s" : ""} · Manage your client database
          </p>
        </div>
        <Button
          onClick={() => { setEditCompany(null); setShowForm(true); }}
          className="gap-2 btn-gradient"
        >
          <Plus className="h-4 w-4" /> Add Company
        </Button>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, city, state…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full shimmer" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Active Loads</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const stats = loadStats[c.name];
                  return (
                    <TableRow
                      key={c.id}
                      className="group hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setDetailCompany(c)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-md bg-accent/10 flex items-center justify-center">
                            <Building2 className="h-3.5 w-3.5 text-accent" />
                          </div>
                          <div>
                            <div>{c.name}</div>
                            {c.industry && (
                              <div className="text-xs text-muted-foreground">{c.industry}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell>{c.phone ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {stats ? (
                          <Badge variant="secondary" className="font-mono">
                            {stats.count}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-400">
                        {stats ? fmtRevenue(stats.revenue) : "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditCompany(c); setShowForm(true); }}
                            className="p-1.5 rounded hover:bg-muted"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => setDeleteId(c.id)}
                            className="p-1.5 rounded hover:bg-destructive/10"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      {search ? `No companies matching "${search}"` : "No companies yet. Add your first client!"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={() => { setShowForm(false); setEditCompany(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editCompany ? "Edit Company" : "Add Company"}</DialogTitle>
            <DialogDescription>
              {editCompany ? "Update the company information below." : "Fill in the details to add a new client."}
            </DialogDescription>
          </DialogHeader>
          <CompanyForm key={editCompany?.id ?? "new"} initial={editCompany} onSubmit={handleSubmit} />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete company?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this company. Existing loads will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Slide-Over */}
      <CompanyDetail
        company={detailCompany}
        open={!!detailCompany}
        onClose={() => setDetailCompany(null)}
        onEdit={(c) => {
          setDetailCompany(null);
          setEditCompany(c);
          setShowForm(true);
        }}
      />
    </div>
  );
}
