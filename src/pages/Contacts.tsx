// ═══════════════════════════════════════════════════════════
// CONTACTS — Company contact management
// ═══════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Pencil, Trash2, Mail, Phone, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────
type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  company_id: string | null;
  notes: string | null;
  created_at: string;
};

type Company = { id: string; name: string };

// ─── Contact Form ────────────────────────────────────────
function ContactForm({
  initial,
  companies,
  onSubmit,
}: {
  initial?: Contact | null;
  companies: Company[];
  onSubmit: (payload: Partial<Contact>) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string>(initial?.company_id ?? "");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    await onSubmit({
      first_name: fd.get("first_name") as string,
      last_name: (fd.get("last_name") as string) || "",
      email: (fd.get("email") as string) || null,
      phone: (fd.get("phone") as string) || null,
      job_title: (fd.get("job_title") as string) || null,
      company_id: companyId || null,
      notes: (fd.get("notes") as string) || null,
    });
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>First Name *</Label>
          <Input name="first_name" defaultValue={initial?.first_name ?? ""} required placeholder="Jane" />
        </div>
        <div>
          <Label>Last Name</Label>
          <Input name="last_name" defaultValue={initial?.last_name ?? ""} placeholder="Smith" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Email</Label>
          <Input name="email" type="email" defaultValue={initial?.email ?? ""} placeholder="jane@example.com" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input name="phone" defaultValue={initial?.phone ?? ""} placeholder="+1 (555) 000-0000" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Job Title</Label>
          <Input name="job_title" defaultValue={initial?.job_title ?? ""} placeholder="Logistics Manager" />
        </div>
        <div>
          <Label>Company</Label>
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger>
              <SelectValue placeholder="Select company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— None —</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea name="notes" defaultValue={initial?.notes ?? ""} rows={2} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={loading} className="btn-gradient">
          {loading ? "Saving…" : initial ? "Save Changes" : "Add Contact"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchContacts = useCallback(async () => {
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setContacts(data as Contact[]);
    setLoading(false);
  }, []);

  const fetchCompanies = useCallback(async () => {
    const { data } = await supabase.from("companies").select("id, name").order("name");
    if (data) setCompanies(data as Company[]);
  }, []);

  useEffect(() => {
    fetchContacts();
    fetchCompanies();
  }, [fetchContacts, fetchCompanies]);

  useEffect(() => {
    const ch = supabase
      .channel("contacts-crm-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, fetchContacts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchContacts]);

  const handleSubmit = async (payload: Partial<Contact>) => {
    if (!user) return;
    if (editContact) {
      const { error } = await supabase
        .from("contacts")
        .update(payload)
        .eq("id", editContact.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Contact updated" });
        setEditContact(null);
        setShowForm(false);
        fetchContacts();
      }
    } else {
      const { error } = await supabase
        .from("contacts")
        .insert({ ...payload, created_by: user.id });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Contact added" });
        setShowForm(false);
        fetchContacts();
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("contacts").delete().eq("id", deleteId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Contact deleted" });
    setDeleteId(null);
    fetchContacts();
  };

  const getCompanyName = (id: string | null) =>
    companies.find((c) => c.id === id)?.name ?? "—";

  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
    const companyName = getCompanyName(c.company_id).toLowerCase();
    return (
      fullName.includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.job_title ?? "").toLowerCase().includes(q) ||
      companyName.includes(q)
    );
  });

  const isFormOpen = showForm || !!editContact;

  return (
    <div className="space-y-4 animate-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Contacts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""} · Manage your contact database
          </p>
        </div>
        <Button
          onClick={() => { setEditContact(null); setShowForm(true); }}
          className="gap-2 btn-gradient"
        >
          <Plus className="h-4 w-4" /> Add Contact
        </Button>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, company, email…"
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
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full shimmer" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">
                          {c.first_name[0]}{(c.last_name ?? " ")[0]}
                        </div>
                        {c.first_name} {c.last_name}
                      </div>
                    </TableCell>
                    <TableCell>{c.job_title ?? "—"}</TableCell>
                    <TableCell>
                      <span className="text-accent">{getCompanyName(c.company_id)}</span>
                    </TableCell>
                    <TableCell>
                      {c.phone ? (
                        <a
                          href={`tel:${c.phone}`}
                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Phone className="h-3 w-3" /> {c.phone}
                        </a>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="flex items-center gap-1 text-muted-foreground hover:text-accent"
                        >
                          <Mail className="h-3 w-3" /> {c.email}
                        </a>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditContact(c); setShowForm(true); }}
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
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      {search
                        ? `No contacts matching "${search}"`
                        : "No contacts yet. Add your first contact!"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={() => { setShowForm(false); setEditContact(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editContact ? "Edit Contact" : "Add Contact"}</DialogTitle>
            <DialogDescription>
              {editContact ? "Update the contact information below." : "Fill in the details to add a new contact."}
            </DialogDescription>
          </DialogHeader>
          <ContactForm
            key={editContact?.id ?? "new"}
            initial={editContact}
            companies={companies}
            onSubmit={handleSubmit}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
