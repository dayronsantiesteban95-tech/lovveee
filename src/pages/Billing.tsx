// -----------------------------------------------------------
// BILLING MODULE -- Phase 2
// Tab 1: Uninvoiced Queue
// Tab 2: Invoices List
// Tab 3: Client Billing Profiles
// QB: QuickBooks Online sync integration
// -----------------------------------------------------------
import { useState, useEffect, useCallback } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { fmtMoney } from "@/lib/formatters";
import { generateBillingInvoice } from "@/lib/generateBillingInvoice";
import { useQuickBooks } from "@/hooks/useQuickBooks";

// -- UI Components ------------------------------------------
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import AccessDenied from "@/components/AccessDenied";

// -- Icons --------------------------------------------------
import {
  ReceiptText, Plus, CheckCircle, Clock, AlertTriangle, Ban,
  DollarSign, Send, Download, Eye, RefreshCw, FileText,
  User, Mail, Calendar, CreditCard, Pencil, X, Check,
  Link2, Loader2, TrendingUp, BarChart3,
} from "lucide-react";

// --- Types ------------------------------------------------
interface UninvoicedLoad {
  id: string;
  reference_number: string | null;
  client_name: string | null;
  load_date: string | null;
  service_type: string | null;
  revenue: number | null;
  status: string | null;
  driver_id: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  client_billing_profile_id: string | null;
  status: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  notes: string | null;
  created_at: string;
}

interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  load_id: string | null;
  description: string;
  reference_number: string | null;
  service_date: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface InvoicePayment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

interface ClientBillingProfile {
  id: string;
  client_name: string;
  billing_email: string | null;
  payment_terms: number;
  invoice_frequency: string;
  fuel_surcharge_pct: number;
  quickbooks_customer_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// --- Status Badge -----------------------------------------
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    draft:   { label: "Draft",   className: "bg-gray-100 text-gray-700 border-gray-300", icon: <FileText className="h-3 w-3" /> },
    sent:    { label: "Sent",    className: "bg-blue-100 text-blue-700 border-blue-300", icon: <Send className="h-3 w-3" /> },
    paid:    { label: "Paid",    className: "bg-green-100 text-green-700 border-green-300", icon: <CheckCircle className="h-3 w-3" /> },
    overdue: { label: "Overdue", className: "bg-red-100 text-red-700 border-red-300", icon: <AlertTriangle className="h-3 w-3" /> },
    void:    { label: "Void",    className: "bg-gray-100 text-gray-400 border-gray-200 line-through", icon: <Ban className="h-3 w-3" /> },
  };
  const c = cfg[status] ?? cfg.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.className}`}>
      {c.icon}{c.label}
    </span>
  );
}

// --- Format date helper -----------------------------------
function fmtDate(d: string | null | undefined): string {
  if (!d) return "--";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "--"; }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// -----------------------------------------------------------
// AR AGING REPORT COMPONENT
// -----------------------------------------------------------

interface AgingBucket {
  label: string;
  minDays: number;
  maxDays: number;
  colorClass: string;
  badgeClass: string;
  rowClass: string;
}

const AGING_BUCKETS: AgingBucket[] = [
  { label: "Current (0-30 days)",  minDays: 0,  maxDays: 30,  colorClass: "text-green-700",  badgeClass: "bg-green-100 text-green-700 border-green-300",  rowClass: "bg-green-50/30" },
  { label: "31-60 days",           minDays: 31, maxDays: 60,  colorClass: "text-yellow-700", badgeClass: "bg-yellow-100 text-yellow-700 border-yellow-300", rowClass: "bg-yellow-50/30" },
  { label: "61-90 days",           minDays: 61, maxDays: 90,  colorClass: "text-orange-700", badgeClass: "bg-orange-100 text-orange-700 border-orange-300", rowClass: "bg-orange-50/30" },
  { label: "90+ days",             minDays: 91, maxDays: Infinity, colorClass: "text-red-700", badgeClass: "bg-red-100 text-red-700 border-red-300", rowClass: "bg-red-50/30" },
];

function daysDiff(dateStr: string): number {
  const due = new Date(dateStr);
  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - due.getTime()) / 86400000);
}

function ARAgingTab({ invoices, loading }: { invoices: Invoice[]; loading: boolean }) {
  const overdueInvoices = invoices.filter(inv =>
    inv.status !== "paid" && inv.status !== "void" && inv.total_amount > inv.amount_paid
  );

  const bucketTotals = AGING_BUCKETS.map(bucket => {
    const items = overdueInvoices.filter(inv => {
      const days = daysDiff(inv.due_date);
      return days >= bucket.minDays && days <= bucket.maxDays;
    });
    const total = items.reduce((s, inv) => s + (inv.total_amount - inv.amount_paid), 0);
    return { bucket, items, total };
  });

  const grandTotal = bucketTotals.reduce((s, b) => s + b.total, 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (overdueInvoices.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold">No outstanding invoices</h3>
          <p className="text-muted-foreground text-sm mt-1">All invoices are paid or voided.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary buckets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {bucketTotals.map(({ bucket, total }) => (
          <Card key={bucket.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground mb-1">{bucket.label}</p>
              <p className={`text-xl font-bold ${bucket.colorClass}`}>{fmtMoney(total)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grand total */}
      <Card className="border-slate-300">
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Total Outstanding AR</span>
            <span className="text-xl font-bold text-slate-800">{fmtMoney(grandTotal)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Per-bucket tables */}
      {bucketTotals.map(({ bucket, items, total }) => {
        if (items.length === 0) return null;
        return (
          <Card key={bucket.label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${bucket.badgeClass}`}>
                    {bucket.label}
                  </span>
                  <span className="text-muted-foreground font-normal text-xs">{items.length} invoice{items.length > 1 ? "s" : ""}</span>
                </CardTitle>
                <span className={`font-bold text-sm ${bucket.colorClass}`}>{fmtMoney(total)}</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Client</TableHead>
                    <TableHead className="text-xs">Invoice #</TableHead>
                    <TableHead className="text-xs">Issue Date</TableHead>
                    <TableHead className="text-xs">Due Date</TableHead>
                    <TableHead className="text-xs text-right">Days Overdue</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                    <TableHead className="text-xs text-right">Paid</TableHead>
                    <TableHead className="text-xs text-right">Balance Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(inv => {
                    const days = daysDiff(inv.due_date);
                    const balance = inv.total_amount - inv.amount_paid;
                    return (
                      <TableRow key={inv.id} className={bucket.rowClass}>
                        <TableCell className="text-xs font-medium">{inv.client_name}</TableCell>
                        <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(inv.issue_date)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(inv.due_date)}</TableCell>
                        <TableCell className={`text-xs text-right font-semibold ${bucket.colorClass}`}>
                          {days <= 0 ? "Current" : `${days}d`}
                        </TableCell>
                        <TableCell className="text-xs text-right">{fmtMoney(inv.total_amount)}</TableCell>
                        <TableCell className="text-xs text-right text-green-700">
                          {inv.amount_paid > 0 ? fmtMoney(inv.amount_paid) : "--"}
                        </TableCell>
                        <TableCell className={`text-xs text-right font-bold ${bucket.colorClass}`}>
                          {fmtMoney(balance)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------
// REVENUE ANALYTICS COMPONENT
// -----------------------------------------------------------

function RevenueAnalyticsTab({ invoices, loading }: { invoices: Invoice[]; loading: boolean }) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
  const lastMonthYear = lastMonthDate.getFullYear();
  const lastMonth = lastMonthDate.getMonth();

  const thisMonthInvoices = invoices.filter(inv => {
    if (inv.status === "void") return false;
    const d = new Date(inv.issue_date);
    return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
  });

  const lastMonthInvoices = invoices.filter(inv => {
    if (inv.status === "void") return false;
    const d = new Date(inv.issue_date);
    return d.getFullYear() === lastMonthYear && d.getMonth() === lastMonth;
  });

  const totalThisMonth = thisMonthInvoices.reduce((s, inv) => s + inv.total_amount, 0);
  const totalLastMonth = lastMonthInvoices.reduce((s, inv) => s + inv.total_amount, 0);
  const collectedThisMonth = thisMonthInvoices.reduce((s, inv) => s + inv.amount_paid, 0);

  const pctChange = totalLastMonth === 0
    ? null
    : ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100;

  const collectionRate = totalThisMonth === 0 ? 0 : (collectedThisMonth / totalThisMonth) * 100;

  const outstandingAR = invoices
    .filter(inv => inv.status !== "paid" && inv.status !== "void")
    .reduce((s, inv) => s + (inv.total_amount - inv.amount_paid), 0);

  // Top 5 clients by total invoiced (all time, non-void)
  const clientRevMap: Record<string, number> = {};
  invoices.forEach(inv => {
    if (inv.status === "void") return;
    clientRevMap[inv.client_name] = (clientRevMap[inv.client_name] ?? 0) + inv.total_amount;
  });
  const top5 = Object.entries(clientRevMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxClientRev = top5.length > 0 ? top5[0][1] : 1;

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (invoices.filter(inv => inv.status !== "void").length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 pb-12 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-30" />
          <h3 className="text-lg font-semibold">No data yet</h3>
          <p className="text-muted-foreground text-sm mt-1">Analytics will appear once invoices are created.</p>
        </CardContent>
      </Card>
    );
  }

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const thisMonthLabel = `${monthNames[thisMonth]} ${thisYear}`;
  const lastMonthLabel = `${monthNames[lastMonth]} ${lastMonthYear}`;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Invoiced This Month</p>
            <p className="text-xl font-bold text-slate-800">{fmtMoney(totalThisMonth)}</p>
            <p className="text-xs text-muted-foreground mt-1">{thisMonthLabel}</p>
            {pctChange !== null && (
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${pctChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                <TrendingUp className="h-3 w-3" />
                {pctChange >= 0 ? "+" : ""}{pctChange.toFixed(1)}% vs {lastMonthLabel}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Invoiced Last Month</p>
            <p className="text-xl font-bold text-slate-800">{fmtMoney(totalLastMonth)}</p>
            <p className="text-xs text-muted-foreground mt-1">{lastMonthLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Collected This Month</p>
            <p className="text-xl font-bold text-green-700">{fmtMoney(collectedThisMonth)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Collection rate: <span className="font-semibold">{collectionRate.toFixed(1)}%</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Outstanding AR</p>
            <p className="text-xl font-bold text-red-700">{fmtMoney(outstandingAR)}</p>
            <p className="text-xs text-muted-foreground mt-1">Unpaid invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 clients */}
      {top5.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              Top Clients by Revenue (All Time)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {top5.map(([clientName, rev], idx) => {
              const barPct = maxClientRev > 0 ? (rev / maxClientRev) * 100 : 0;
              return (
                <div key={clientName} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono w-4">{idx + 1}.</span>
                      <span className="font-medium truncate max-w-48">{clientName}</span>
                    </div>
                    <span className="font-semibold text-slate-700 shrink-0">{fmtMoney(rev)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${barPct.toFixed(1)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// -----------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------
function Billing() {
  const { user } = useAuth();
  const { role, isOwner, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  // -- QuickBooks integration -----------------------------
  const { connected: qbConnected, loading: qbLoading, connect: connectQB, syncInvoice: syncQBInvoice } = useQuickBooks();
  const [syncingInvoiceId, setSyncingInvoiceId] = useState<string | null>(null);

  // -- Tab state ------------------------------------------
  const [activeTab, setActiveTab] = useState("uninvoiced");

  // -- React Query ----------------------------------------
  const queryClient = useQueryClient();

  const { data: uninvoicedLoads = [], isLoading: loadingUninvoiced } = useQuery({
    queryKey: ["billing-uninvoiced"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_uninvoiced_loads");
      if (error) throw error;
      return (data as UninvoicedLoad[]) ?? [];
    },
    staleTime: 30_000,
    retry: 3,
    enabled: !!user,
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["billing-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Invoice[]) ?? [];
    },
    staleTime: 30_000,
    retry: 3,
    enabled: !!user,
  });

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["billing-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_billing_profiles")
        .select("*")
        .order("client_name");
      if (error) throw error;
      return (data as ClientBillingProfile[]) ?? [];
    },
    staleTime: 30_000,
    retry: 3,
    enabled: !!user,
  });

  // -- Selections ----------------------------------------
  const [selectedLoadIds, setSelectedLoadIds] = useState<Set<string>>(new Set());

  // -- Create Invoice Modal ------------------------------
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDaysISO(todayISO(), 30));
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [savingInvoice, setSavingInvoice] = useState(false);

  // -- Invoice Detail Sheet ------------------------------
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceLineItems, setInvoiceLineItems] = useState<InvoiceLineItem[]>([]);
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // -- Record Payment Modal ------------------------------
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState("check");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  // -- Invoice filter ------------------------------------
  const [statusFilter, setStatusFilter] = useState("all");

  // -- Batch invoice selection ---------------------------
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [batchActing, setBatchActing] = useState(false);

  // -- Profile Modal -------------------------------------
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ClientBillingProfile | null>(null);
  const [profileForm, setProfileForm] = useState({
    client_name: "",
    billing_email: "",
    payment_terms: 30,
    invoice_frequency: "per_load",
    fuel_surcharge_pct: 0,
    notes: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // --- Helpers to refetch after mutations ---------------
  const fetchUninvoiced = useCallback(() => queryClient.invalidateQueries({ queryKey: ["billing-uninvoiced"] }), [queryClient]);
  const fetchInvoices = useCallback(() => queryClient.invalidateQueries({ queryKey: ["billing-invoices"] }), [queryClient]);
  const fetchProfiles = useCallback(() => queryClient.invalidateQueries({ queryKey: ["billing-profiles"] }), [queryClient]);

  // --- Batch: mark selected invoices as sent ------------
  const batchMarkSent = async () => {
    if (selectedInvoiceIds.size === 0) return;
    setBatchActing(true);
    try {
      const ids = Array.from(selectedInvoiceIds);
      const { error } = await supabase
        .from("invoices")
        .update({ status: "sent" })
        .in("id", ids);
      if (error) throw error;
      toast({ title: "Marked as Sent", description: `${ids.length} invoice${ids.length > 1 ? "s" : ""} marked as sent.` });
      setSelectedInvoiceIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
    } catch (err) {
      toast({ title: "Error", description: "Could not update invoices.", variant: "destructive" });
    } finally {
      setBatchActing(false);
    }
  };

  // --- Batch: mark selected invoices as paid ------------
  const batchMarkPaid = async () => {
    if (selectedInvoiceIds.size === 0) return;
    setBatchActing(true);
    try {
      const ids = Array.from(selectedInvoiceIds);
      const targets = invoices.filter(inv => ids.includes(inv.id));

      // Update invoice status and insert payment records for audit trail
      const results = await Promise.all(
        targets.map(async (inv) => {
          const remainingBalance = inv.total_amount - inv.amount_paid;
          // Insert payment record for audit trail
          if (remainingBalance > 0) {
            const { error: payErr } = await supabase.from("invoice_payments").insert({
              invoice_id: inv.id,
              amount: remainingBalance,
              payment_date: todayISO(),
              payment_method: "batch",
              reference_number: null,
              notes: "Batch marked as paid",
              recorded_by: user?.id ?? null,
            });
            if (payErr) return { error: payErr };
          }
          // Update invoice status
          return supabase.from("invoices").update({ status: "paid", amount_paid: inv.total_amount }).eq("id", inv.id);
        })
      );
      const anyError = results.find(r => r.error);
      if (anyError?.error) throw anyError.error;
      toast({ title: "Marked as Paid", description: `${ids.length} invoice${ids.length > 1 ? "s" : ""} marked as paid.` });
      setSelectedInvoiceIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
    } catch (err) {
      toast({ title: "Error", description: "Could not update invoices.", variant: "destructive" });
    } finally {
      setBatchActing(false);
    }
  };

  // --- Load detail on invoice open ---------------------
  const openInvoiceDetail = useCallback(async (inv: Invoice) => {
    setSelectedInvoice(inv);
    setDetailOpen(true);
    setLoadingDetail(true);
    try {
      const [{ data: lines, error: linesErr }, { data: payments, error: paymentsErr }] = await Promise.all([
        supabase.from("invoice_line_items").select("*").eq("invoice_id", inv.id).order("service_date"),
        supabase.from("invoice_payments").select("*").eq("invoice_id", inv.id).order("payment_date"),
      ]);
      if (linesErr || paymentsErr) throw linesErr ?? paymentsErr;
      setInvoiceLineItems((lines as InvoiceLineItem[]) ?? []);
      setInvoicePayments((payments as InvoicePayment[]) ?? []);
    } catch (err) {
      toast({ title: "Error loading invoice details", description: "Could not load line items or payments.", variant: "destructive" });
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // --- Create Invoice Modal open ------------------------
  const openCreateModal = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("generate_invoice_number");
      if (error) throw error;
      setInvoiceNumber((data as string) ?? `INV-${Date.now()}`);
    } catch {
      setInvoiceNumber(`INV-${new Date().getFullYear().toString().slice(2)}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`);
    }
    setIssueDate(todayISO());
    // Use client payment terms if a billing profile exists for the selected loads
    const clientName = selectedLoads[0]?.client_name ?? "";
    const clientProfile = profiles.find(p => p.client_name === clientName);
    const termsDays = clientProfile?.payment_terms ?? 30;
    setDueDate(addDaysISO(todayISO(), termsDays));
    setInvoiceNotes("");
    setCreateModalOpen(true);
  }, [selectedLoads, profiles]);

  // --- Selected loads data ------------------------------
  const selectedLoads = uninvoicedLoads.filter(l => selectedLoadIds.has(l.id));
  const selectedTotal = selectedLoads.reduce((s, l) => s + (l.revenue ?? 0), 0);

  // Group by client
  const loadsByClient = uninvoicedLoads.reduce<Record<string, UninvoicedLoad[]>>((acc, load) => {
    const key = load.client_name ?? "Unknown Client";
    if (!acc[key]) acc[key] = [];
    acc[key].push(load);
    return acc;
  }, {});

  // --- Toggle load selection ----------------------------
  const toggleLoad = (id: string) => {
    setSelectedLoadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectClientLoads = (clientName: string) => {
    const clientLoadIds = (loadsByClient[clientName] ?? []).map(l => l.id);
    setSelectedLoadIds(prev => {
      const next = new Set(prev);
      const allSelected = clientLoadIds.every(id => next.has(id));
      if (allSelected) {
        clientLoadIds.forEach(id => next.delete(id));
      } else {
        clientLoadIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // --- Save Invoice ------------------------------------
  const saveInvoice = async () => {
    if (selectedLoads.length === 0) {
      toast({ title: "No loads selected", description: "Select at least one load to invoice.", variant: "destructive" });
      return;
    }
    if (selectedTotal <= 0) {
      toast({ title: "Zero revenue", description: "Cannot create an invoice with $0 total. Check load revenue values.", variant: "destructive" });
      return;
    }
    // Validate all selected loads belong to the same client
    const clientNames = new Set(selectedLoads.map(l => l.client_name ?? "Unknown Client"));
    if (clientNames.size > 1) {
      toast({
        title: "Mixed clients",
        description: `Selected loads belong to multiple clients (${Array.from(clientNames).join(", ")}). Please select loads from a single client.`,
        variant: "destructive",
      });
      return;
    }
    setSavingInvoice(true);
    try {
      // BUG-B6: Check invoice number uniqueness client-side
      const { data: existingInv } = await supabase
        .from("invoices")
        .select("id")
        .eq("invoice_number", invoiceNumber)
        .maybeSingle();
      if (existingInv) {
        toast({ title: "Invoice number already exists", variant: "destructive" });
        setSavingInvoice(false);
        return;
      }

      // Determine client name from selected loads (validated to be single client above)
      const clientName = selectedLoads[0].client_name ?? "Unknown Client";
      const subtotal = selectedTotal;

      // Look up client billing profile for fuel surcharge and payment terms
      const clientProfile = profiles.find(p => p.client_name === clientName);
      const fuelSurchargePct = clientProfile?.fuel_surcharge_pct ?? 0;
      const fuelSurchargeAmount = fuelSurchargePct > 0 ? subtotal * (fuelSurchargePct / 100) : 0;
      const totalAmount = subtotal + fuelSurchargeAmount;

      // Adjust due date based on client payment terms
      const paymentTermsDays = clientProfile?.payment_terms ?? 30;
      const adjustedDueDate = addDaysISO(issueDate, paymentTermsDays);

      // Insert invoice
      const { data: invData, error: invErr } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          client_name: clientName,
          client_billing_profile_id: clientProfile?.id ?? null,
          status: "draft",
          issue_date: issueDate,
          due_date: adjustedDueDate,
          subtotal,
          tax_amount: fuelSurchargeAmount,
          total_amount: totalAmount,
          amount_paid: 0,
          notes: invoiceNotes || null,
          created_by: user?.id ?? null,
        })
        .select()
        .single();

      if (invErr) throw invErr;
      const inv = invData as Invoice;

      // Insert line items
      const lineItems = selectedLoads.map(load => ({
        invoice_id: inv.id,
        load_id: load.id,
        description: `${load.service_type ?? "Service"} -- Ref: ${load.reference_number ?? load.id.slice(0, 8)}`,
        reference_number: load.reference_number,
        service_date: load.load_date,
        quantity: 1,
        unit_price: load.revenue ?? 0,
        subtotal: load.revenue ?? 0,
      }));

      const { error: lineErr } = await supabase.from("invoice_line_items").insert(lineItems);
      if (lineErr) throw lineErr;

      toast({ title: "Invoice created!", description: `${invoiceNumber} saved as draft.` });
      setCreateModalOpen(false);
      setSelectedLoadIds(new Set());
      fetchUninvoiced();
      fetchInvoices();
    } catch (err) {
            toast({ title: "Error", description: "Could not create invoice. Please try again.", variant: "destructive" });
    } finally {
      setSavingInvoice(false);
    }
  };

  // --- Mark invoice sent --------------------------------
  const markSent = async (inv: Invoice) => {
    const { error } = await supabase.from("invoices").update({ status: "sent" }).eq("id", inv.id);
    if (error) {
      toast({ title: "Error", description: "Could not update status", variant: "destructive" });
      return;
    }
    toast({ title: "Marked as Sent", description: `Invoice ${inv.invoice_number} is now sent.` });
    fetchInvoices();
    if (selectedInvoice?.id === inv.id) setSelectedInvoice({ ...selectedInvoice, status: "sent" });
  };

  // --- Void invoice -------------------------------------
  const voidInvoice = async (inv: Invoice) => {
    if (!confirm(`Void invoice ${inv.invoice_number}? This cannot be undone.`)) return;
    const { error } = await supabase.from("invoices").update({ status: "void" }).eq("id", inv.id);
    if (error) {
      toast({ title: "Error", description: "Could not void invoice", variant: "destructive" });
      return;
    }
    toast({ title: "Voided", description: `Invoice ${inv.invoice_number} has been voided.` });
    fetchInvoices();
    if (detailOpen && selectedInvoice?.id === inv.id) setDetailOpen(false);
  };

  // --- Record Payment -----------------------------------
  const openPaymentModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setPaymentAmount(String(inv.total_amount - inv.amount_paid));
    setPaymentDate(todayISO());
    setPaymentMethod("check");
    setPaymentRef("");
    setPaymentNotes("");
    setPaymentModalOpen(true);
  };

  const savePayment = async () => {
    if (!selectedInvoice) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    const remainingBalance = selectedInvoice.total_amount - selectedInvoice.amount_paid;
    if (amount > remainingBalance) {
      toast({
        title: "Payment exceeds balance",
        description: `Remaining balance is ${fmtMoney(remainingBalance)}. Payment cannot exceed this amount.`,
        variant: "destructive",
      });
      return;
    }
    setSavingPayment(true);
    try {
      const { error: payErr } = await supabase.from("invoice_payments").insert({
        invoice_id: selectedInvoice.id,
        amount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference_number: paymentRef || null,
        notes: paymentNotes || null,
        recorded_by: user?.id ?? null,
      });
      if (payErr) throw payErr;

      // Update amount_paid on invoice
      const newAmountPaid = selectedInvoice.amount_paid + amount;
      const newStatus = newAmountPaid >= selectedInvoice.total_amount ? "paid" : selectedInvoice.status;
      const { error: invErr } = await supabase.from("invoices").update({
        amount_paid: newAmountPaid,
        status: newStatus,
      }).eq("id", selectedInvoice.id);
      if (invErr) throw invErr;

      toast({ title: "Payment recorded!", description: `${fmtMoney(amount)} recorded.` });
      setPaymentModalOpen(false);
      fetchInvoices();
      if (detailOpen) openInvoiceDetail({ ...selectedInvoice, amount_paid: newAmountPaid, status: newStatus });
    } catch (err) {
            toast({ title: "Error", description: "Could not record payment", variant: "destructive" });
    } finally {
      setSavingPayment(false);
    }
  };

  // --- Download PDF -------------------------------------
  const downloadPDF = (inv: Invoice, lineItems: InvoiceLineItem[]) => {
    try {
      generateBillingInvoice({
        invoice_number: inv.invoice_number,
        client_name: inv.client_name,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        status: inv.status,
        subtotal: inv.subtotal,
        tax_amount: inv.tax_amount,
        total_amount: inv.total_amount,
        amount_paid: inv.amount_paid,
        notes: inv.notes,
        line_items: lineItems.map(li => ({
          description: li.description,
          reference_number: li.reference_number,
          service_date: li.service_date,
          quantity: li.quantity,
          unit_price: li.unit_price,
          subtotal: li.subtotal,
        })),
      });
      toast({ title: "PDF downloaded", description: `Invoice ${inv.invoice_number} saved.` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred while generating the PDF.";
      toast({
        title: "PDF generation failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  // --- Sync invoice to QuickBooks -----------------------
  const syncToQB = async (inv: Invoice) => {
    if (!qbConnected) {
      toast({ title: "QuickBooks not connected", description: "Connect QuickBooks first.", variant: "destructive" });
      return;
    }
    setSyncingInvoiceId(inv.id);
    try {
      const { qbInvoiceId, qbInvoiceNumber } = await syncQBInvoice(inv.id);
      toast({
        title: "Synced to QuickBooks",
        description: `QB Invoice #${qbInvoiceNumber} (ID: ${qbInvoiceId})`,
      });
      fetchInvoices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sync failed";
      toast({ title: "QuickBooks Sync Failed", description: message, variant: "destructive" });
    } finally {
      setSyncingInvoiceId(null);
    }
  };

  // --- Profile save -------------------------------------
  const openProfileModal = (profile?: ClientBillingProfile) => {
    if (profile) {
      setEditingProfile(profile);
      setProfileForm({
        client_name: profile.client_name,
        billing_email: profile.billing_email ?? "",
        payment_terms: profile.payment_terms,
        invoice_frequency: profile.invoice_frequency,
        fuel_surcharge_pct: profile.fuel_surcharge_pct,
        notes: profile.notes ?? "",
      });
    } else {
      setEditingProfile(null);
      setProfileForm({ client_name: "", billing_email: "", payment_terms: 30, invoice_frequency: "per_load", fuel_surcharge_pct: 0, notes: "" });
    }
    setProfileModalOpen(true);
  };

  const saveProfile = async () => {
    if (!profileForm.client_name.trim()) {
      toast({ title: "Client name required", variant: "destructive" });
      return;
    }
    // BUG-B7: Validate billing email format
    if (profileForm.billing_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(profileForm.billing_email)) {
        toast({ title: "Invalid email format", description: "Please enter a valid billing email address.", variant: "destructive" });
        return;
      }
    }
    setSavingProfile(true);
    try {
      const payload = {
        client_name: profileForm.client_name.trim(),
        billing_email: profileForm.billing_email || null,
        payment_terms: profileForm.payment_terms,
        invoice_frequency: profileForm.invoice_frequency,
        fuel_surcharge_pct: profileForm.fuel_surcharge_pct,
        notes: profileForm.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (editingProfile) {
        const { error } = await supabase.from("client_billing_profiles").update(payload).eq("id", editingProfile.id);
        if (error) throw error;
        toast({ title: "Profile updated!", description: profileForm.client_name });
      } else {
        const { error } = await supabase.from("client_billing_profiles").insert(payload);
        if (error) throw error;
        toast({ title: "Profile created!", description: profileForm.client_name });
      }
      setProfileModalOpen(false);
      fetchProfiles();
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "Could not save profile", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  // --- Filtered invoices --------------------------------
  const filteredInvoices = statusFilter === "all"
    ? invoices
    : invoices.filter(i => i.status === statusFilter);

  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------
  // -- Role guard: only owners/dispatchers may access Billing --
  if (roleLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (role !== "owner" && role !== "dispatcher") return <AccessDenied message="Admin or dispatcher access required to view Billing." />;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ReceiptText className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Billing</h1>
            <p className="text-sm text-muted-foreground">Invoices, payments & client profiles</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedLoadIds.size > 0 && (
            <Button onClick={openCreateModal} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4" />
              Create Invoice ({selectedLoadIds.size} load{selectedLoadIds.size > 1 ? "s" : ""})
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => { fetchUninvoiced(); fetchInvoices(); fetchProfiles(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* -- QuickBooks Connection Banner -------------------- */}
      {/* Only owners can manage QuickBooks OAuth. Dispatchers see a read-only status. */}
      {!qbLoading && (
        qbConnected ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            <span>QuickBooks Connected (Sandbox)</span>
          </div>
        ) : isOwner ? (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-yellow-50 border border-yellow-300 text-yellow-800">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-yellow-600" />
              <span className="font-medium">QuickBooks not connected</span>
              <span className="text-yellow-700 hidden sm:inline">-- Connect to sync invoices automatically.</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-yellow-400 text-yellow-800 hover:bg-yellow-100 shrink-0 gap-1"
              onClick={connectQB}
            >
              <Link2 className="h-3 w-3" />
              Connect Now
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <span>QuickBooks not connected -- Contact your owner to manage QuickBooks settings.</span>
          </div>
        )
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="uninvoiced" className="gap-1 text-xs sm:text-sm">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Uninvoiced</span>
            <span className="sm:hidden">Queue</span>
            {uninvoicedLoads.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full font-semibold">
                {uninvoicedLoads.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1 text-xs sm:text-sm">
            <ReceiptText className="h-4 w-4" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-1 text-xs sm:text-sm">
            <User className="h-4 w-4" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="aging" className="gap-1 text-xs sm:text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">AR Aging</span>
            <span className="sm:hidden">Aging</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1 text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
            <span className="sm:hidden">Stats</span>
          </TabsTrigger>
        </TabsList>

        {/* -------------------------------------------------- */}
        {/* TAB 1: UNINVOICED QUEUE                           */}
        {/* -------------------------------------------------- */}
        <TabsContent value="uninvoiced" className="mt-4">
          {loadingUninvoiced ? (
            <Card>
              <CardContent className="pt-6 space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </CardContent>
            </Card>
          ) : uninvoicedLoads.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold">All loads invoiced!</h3>
                <p className="text-muted-foreground text-sm mt-1">No completed loads are waiting to be invoiced.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {selectedLoadIds.size > 0 && (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="pt-4 pb-4 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-blue-700">{selectedLoadIds.size} load{selectedLoadIds.size > 1 ? "s" : ""} selected</span>
                      <span className="text-blue-600 ml-2">-- Total: {fmtMoney(selectedTotal)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedLoadIds(new Set())}>
                        <X className="h-4 w-4 mr-1" /> Clear
                      </Button>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={openCreateModal}>
                        <Plus className="h-4 w-4 mr-1" /> Create Invoice
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {Object.entries(loadsByClient).map(([clientName, loads]) => {
                const clientTotal = loads.reduce((s, l) => s + (l.revenue ?? 0), 0);
                const allClientSelected = loads.every(l => selectedLoadIds.has(l.id));
                const someClientSelected = loads.some(l => selectedLoadIds.has(l.id));

                return (
                  <Card key={clientName}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={allClientSelected}
                            onCheckedChange={() => selectClientLoads(clientName)}
                            className={someClientSelected && !allClientSelected ? "opacity-50" : ""}
                          />
                          <CardTitle className="text-base">{clientName}</CardTitle>
                          <Badge variant="outline" className="text-xs">{loads.length} load{loads.length > 1 ? "s" : ""}</Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-green-700">{fmtMoney(clientTotal)}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-600 border-blue-300 hover:bg-blue-50"
                            onClick={() => {
                              selectClientLoads(clientName);
                              // Ensure all client loads are selected then open
                              const ids = loads.map(l => l.id);
                              setSelectedLoadIds(prev => {
                                const next = new Set(prev);
                                ids.forEach(id => next.add(id));
                                return next;
                              });
                              // Open create modal after state updates
                              setTimeout(openCreateModal, 100);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Invoice All
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Ref #</TableHead>
                            <TableHead>Service Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loads.map(load => (
                            <TableRow key={load.id} className={selectedLoadIds.has(load.id) ? "bg-blue-50/50" : ""}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedLoadIds.has(load.id)}
                                  onCheckedChange={() => toggleLoad(load.id)}
                                />
                              </TableCell>
                              <TableCell className="text-sm">{fmtDate(load.load_date)}</TableCell>
                              <TableCell className="font-mono text-sm">{load.reference_number ?? "--"}</TableCell>
                              <TableCell className="text-sm">{load.service_type ?? "--"}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs capitalize">{load.status}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-700">
                                {fmtMoney(load.revenue ?? 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* -------------------------------------------------- */}
        {/* TAB 2: INVOICES LIST                              */}
        {/* -------------------------------------------------- */}
        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">All Invoices</CardTitle>
                  {selectedInvoiceIds.size > 0 && (
                    <span className="text-xs text-muted-foreground">{selectedInvoiceIds.size} selected</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedInvoiceIds.size > 0 && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1 text-blue-700 border-blue-300 hover:bg-blue-50"
                        disabled={batchActing}
                        onClick={batchMarkSent}
                      >
                        <Send className="h-3 w-3" />
                        Mark Sent ({selectedInvoiceIds.size})
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                        disabled={batchActing}
                        onClick={batchMarkPaid}
                      >
                        <Check className="h-3 w-3" />
                        Mark Paid ({selectedInvoiceIds.size})
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => setSelectedInvoiceIds(new Set())}
                      >
                        <X className="h-3 w-3 mr-1" /> Clear
                      </Button>
                    </>
                  )}
                  <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setSelectedInvoiceIds(new Set()); }}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="void">Void</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingInvoices ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ReceiptText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>No invoices yet. Create one from the Uninvoiced tab.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={filteredInvoices.length > 0 && filteredInvoices.every(inv => selectedInvoiceIds.has(inv.id))}
                          onCheckedChange={checked => {
                            if (checked) {
                              setSelectedInvoiceIds(new Set(filteredInvoices.map(inv => inv.id)));
                            } else {
                              setSelectedInvoiceIds(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>QB Sync</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map(inv => {
                      const isSyncedToQB = !!(inv as Invoice & { quickbooks_invoice_id?: string }).quickbooks_invoice_id;
                      const isSyncing = syncingInvoiceId === inv.id;
                      const isChecked = selectedInvoiceIds.has(inv.id);
                      return (
                        <TableRow
                          key={inv.id}
                          className={`cursor-pointer hover:bg-muted/40 ${isChecked ? "bg-blue-50/50" : ""}`}
                          onClick={() => openInvoiceDetail(inv)}
                        >
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => {
                                setSelectedInvoiceIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(inv.id)) next.delete(inv.id); else next.add(inv.id);
                                  return next;
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm font-semibold">{inv.invoice_number}</TableCell>
                          <TableCell>{inv.client_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmtDate(inv.issue_date)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmtDate(inv.due_date)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmtMoney(inv.total_amount)}</TableCell>
                          <TableCell><StatusBadge status={inv.status} /></TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            {isSyncedToQB ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                                <CheckCircle className="h-3 w-3" /> Synced
                              </span>
                            ) : inv.status === "void" ? (
                              <span className="text-xs text-muted-foreground">--</span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 gap-1"
                                disabled={isSyncing || !qbConnected}
                                onClick={() => syncToQB(inv)}
                                title={qbConnected ? "Sync to QuickBooks" : "Connect QuickBooks first"}
                              >
                                {isSyncing ? (
                                  <><Loader2 className="h-3 w-3 animate-spin" /> Syncing...</>
                                ) : (
                                  <><Link2 className="h-3 w-3" /> Sync to QB</>
                                )}
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                              {inv.status === "draft" && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markSent(inv)}>
                                  <Send className="h-3 w-3 mr-1" /> Send
                                </Button>
                              )}
                              {(inv.status === "sent" || inv.status === "overdue") && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openPaymentModal(inv)}>
                                  <DollarSign className="h-3 w-3 mr-1" /> Payment
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openInvoiceDetail(inv)}>
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------------------------------------- */}
        {/* TAB 3: CLIENT BILLING PROFILES                   */}
        {/* -------------------------------------------------- */}
        <TabsContent value="clients" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Client Billing Profiles</h2>
            <Button size="sm" onClick={() => openProfileModal()} className="gap-2">
              <Plus className="h-4 w-4" /> Add Client Profile
            </Button>
          </div>

          {loadingProfiles ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : profiles.length === 0 ? (
            <Card>
              <CardContent className="pt-10 pb-10 text-center text-muted-foreground">
                <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No client profiles yet. Add one to store billing preferences.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {profiles.map(profile => (
                <Card key={profile.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-base">{profile.client_name}</h3>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          {profile.billing_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {profile.billing_email}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Net-{profile.payment_terms}
                          </span>
                          <span className="flex items-center gap-1">
                            <CreditCard className="h-3 w-3" />
                            {profile.invoice_frequency === "per_load" ? "Per Load" :
                             profile.invoice_frequency === "weekly" ? "Weekly" : "Monthly"}
                          </span>
                          {profile.fuel_surcharge_pct > 0 && (
                            <span className="text-orange-600">Fuel: {profile.fuel_surcharge_pct}%</span>
                          )}
                        </div>
                        {profile.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{profile.notes}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openProfileModal(profile)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* -------------------------------------------------- */}
        {/* TAB 4: AR AGING REPORT                            */}
        {/* -------------------------------------------------- */}
        <TabsContent value="aging" className="mt-4">
          <ARAgingTab invoices={invoices} loading={loadingInvoices} />
        </TabsContent>

        {/* -------------------------------------------------- */}
        {/* TAB 5: REVENUE ANALYTICS                          */}
        {/* -------------------------------------------------- */}
        <TabsContent value="analytics" className="mt-4">
          <RevenueAnalyticsTab invoices={invoices} loading={loadingInvoices} />
        </TabsContent>
      </Tabs>

      {/* ----------------------------------------------------- */}
      {/* CREATE INVOICE MODAL                                  */}
      {/* ----------------------------------------------------- */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-blue-600" />
              Create Invoice
            </DialogTitle>
            <DialogDescription>
              Review line items and save as draft for manual review before sending.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Invoice meta */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Invoice #</Label>
                <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label>Client</Label>
                <Input value={selectedLoads[0]?.client_name ?? "--"} readOnly className="bg-muted" />
              </div>
              <div className="space-y-1">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={e => {
                    setIssueDate(e.target.value);
                    const cName = selectedLoads[0]?.client_name ?? "";
                    const cProfile = profiles.find(p => p.client_name === cName);
                    const tDays = cProfile?.payment_terms ?? 30;
                    setDueDate(addDaysISO(e.target.value, tDays));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>Due Date (Net-{(() => {
                  const cName = selectedLoads[0]?.client_name ?? "";
                  const cProfile = profiles.find(p => p.client_name === cName);
                  return cProfile?.payment_terms ?? 30;
                })()})</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>

            {/* Line items */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Line Items ({selectedLoads.length})</Label>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Ref #</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedLoads.map(load => (
                      <TableRow key={load.id}>
                        <TableCell className="text-xs">{fmtDate(load.load_date)}</TableCell>
                        <TableCell className="font-mono text-xs">{load.reference_number ?? "--"}</TableCell>
                        <TableCell className="text-xs">{load.service_type ?? "Service"}</TableCell>
                        <TableCell className="text-xs text-right font-semibold">{fmtMoney(load.revenue ?? 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-end">
              {(() => {
                const cName = selectedLoads[0]?.client_name ?? "";
                const cProfile = profiles.find(p => p.client_name === cName);
                const fsPct = cProfile?.fuel_surcharge_pct ?? 0;
                const fsAmt = fsPct > 0 ? selectedTotal * (fsPct / 100) : 0;
                const grandTotal = selectedTotal + fsAmt;
                return (
                  <div className="space-y-1 text-right min-w-48">
                    <div className="flex justify-between gap-8 text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-semibold">{fmtMoney(selectedTotal)}</span>
                    </div>
                    {fsPct > 0 && (
                      <div className="flex justify-between gap-8 text-sm">
                        <span className="text-muted-foreground">Fuel Surcharge ({fsPct}%)</span>
                        <span className="font-semibold text-orange-600">{fmtMoney(fsAmt)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between gap-8">
                      <span className="font-bold text-base">Total</span>
                      <span className="font-bold text-base text-green-700">{fmtMoney(grandTotal)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea
                value={invoiceNotes}
                onChange={e => setInvoiceNotes(e.target.value)}
                placeholder="PO number, special instructions, etc."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateModalOpen(false)} disabled={savingInvoice}>Cancel</Button>
            <Button
              onClick={saveInvoice}
              disabled={savingInvoice || selectedLoads.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {savingInvoice ? "Saving..." : "Save as Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------- */}
      {/* INVOICE DETAIL SLIDE-OVER                            */}
      {/* ----------------------------------------------------- */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-blue-600" />
              {selectedInvoice?.invoice_number ?? "Invoice"}
            </SheetTitle>
            <SheetDescription className="flex items-center gap-2">
              {selectedInvoice && <StatusBadge status={selectedInvoice.status} />}
            </SheetDescription>
          </SheetHeader>

          {selectedInvoice && (
            <div className="space-y-5">
              {/* Header info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Bill To</p>
                  <p className="font-semibold">{selectedInvoice.client_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Status</p>
                  <StatusBadge status={selectedInvoice.status} />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Issue Date</p>
                  <p>{fmtDate(selectedInvoice.issue_date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Due Date</p>
                  <p>{fmtDate(selectedInvoice.due_date)}</p>
                </div>
              </div>

              <Separator />

              {/* Line items */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Line Items</h4>
                {loadingDetail ? (
                  <div className="space-y-1">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : (
                  <div className="rounded border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs">Ref #</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceLineItems.map(li => (
                          <TableRow key={li.id}>
                            <TableCell className="text-xs">{li.description}</TableCell>
                            <TableCell className="text-xs font-mono">{li.reference_number ?? "--"}</TableCell>
                            <TableCell className="text-xs text-right font-semibold">{fmtMoney(li.subtotal)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="space-y-1 text-sm border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{fmtMoney(selectedInvoice.subtotal)}</span>
                </div>
                {selectedInvoice.tax_amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{fmtMoney(selectedInvoice.tax_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1 border-t">
                  <span>Total</span>
                  <span>{fmtMoney(selectedInvoice.total_amount)}</span>
                </div>
                {selectedInvoice.amount_paid > 0 && (
                  <>
                    <div className="flex justify-between text-green-700">
                      <span>Amount Paid</span>
                      <span>{fmtMoney(selectedInvoice.amount_paid)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-red-700">
                      <span>Balance Due</span>
                      <span>{fmtMoney(selectedInvoice.total_amount - selectedInvoice.amount_paid)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Payments */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Payment History</h4>
                {invoicePayments.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No payments recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {invoicePayments.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-sm rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                        <div>
                          <span className="font-semibold text-green-700">{fmtMoney(p.amount)}</span>
                          <span className="text-muted-foreground ml-2 text-xs capitalize">{p.payment_method}</span>
                          {p.reference_number && <span className="text-xs text-muted-foreground ml-2">#{p.reference_number}</span>}
                        </div>
                        <span className="text-xs text-muted-foreground">{fmtDate(p.payment_date)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedInvoice.notes && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">Notes</h4>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.notes}</p>
                </div>
              )}

              <Separator />

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {selectedInvoice.status === "draft" && (
                  <Button size="sm" variant="outline" onClick={() => markSent(selectedInvoice)} className="gap-1">
                    <Send className="h-3 w-3" /> Mark Sent
                  </Button>
                )}
                {(selectedInvoice.status === "sent" || selectedInvoice.status === "overdue") && (
                  <Button size="sm" variant="outline" onClick={() => openPaymentModal(selectedInvoice)} className="gap-1 text-green-700 border-green-300">
                    <DollarSign className="h-3 w-3" /> Record Payment
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadPDF(selectedInvoice, invoiceLineItems)}
                  className="gap-1"
                >
                  <Download className="h-3 w-3" /> Download PDF
                </Button>
                {selectedInvoice.status !== "void" && selectedInvoice.status !== "paid" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => voidInvoice(selectedInvoice)}
                    className="gap-1 text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Ban className="h-3 w-3" /> Void
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ----------------------------------------------------- */}
      {/* RECORD PAYMENT MODAL                                  */}
      {/* ----------------------------------------------------- */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Record Payment
            </DialogTitle>
            <DialogDescription>
              {selectedInvoice?.invoice_number} -- {selectedInvoice?.client_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label>Payment Date</Label>
              <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="wire">Wire Transfer</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Reference # (check #, wire ref, etc.)</Label>
              <Input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} rows={2} placeholder="Optional" />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)} disabled={savingPayment}>Cancel</Button>
            <Button onClick={savePayment} disabled={savingPayment} className="bg-green-600 hover:bg-green-700 text-white">
              {savingPayment ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------- */}
      {/* CLIENT PROFILE MODAL                                  */}
      {/* ----------------------------------------------------- */}
      <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              {editingProfile ? "Edit Client Profile" : "New Client Profile"}
            </DialogTitle>
            <DialogDescription>
              Billing preferences for this client.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Client Name *</Label>
              <Input
                value={profileForm.client_name}
                onChange={e => setProfileForm(p => ({ ...p, client_name: e.target.value }))}
                placeholder="e.g. PGL Aero Team"
                disabled={!!editingProfile}
              />
            </div>
            <div className="space-y-1">
              <Label>Billing Email</Label>
              <Input
                type="email"
                value={profileForm.billing_email}
                onChange={e => setProfileForm(p => ({ ...p, billing_email: e.target.value }))}
                placeholder="billing@client.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Payment Terms (days)</Label>
                <Input
                  type="number"
                  value={profileForm.payment_terms}
                  onChange={e => setProfileForm(p => ({ ...p, payment_terms: parseInt(e.target.value) || 30 }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Fuel Surcharge %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={profileForm.fuel_surcharge_pct}
                  onChange={e => setProfileForm(p => ({ ...p, fuel_surcharge_pct: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Invoice Frequency</Label>
              <Select value={profileForm.invoice_frequency} onValueChange={v => setProfileForm(p => ({ ...p, invoice_frequency: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_load">Per Load</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={profileForm.notes}
                onChange={e => setProfileForm(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Internal notes..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setProfileModalOpen(false)} disabled={savingProfile}>Cancel</Button>
            <Button onClick={saveProfile} disabled={savingProfile} className="bg-blue-600 hover:bg-blue-700 text-white">
              {savingProfile ? "Saving..." : (editingProfile ? "Save Changes" : "Create Profile")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function BillingPage() {
  return (
    <ErrorBoundary>
      <Billing />
    </ErrorBoundary>
  );
}
