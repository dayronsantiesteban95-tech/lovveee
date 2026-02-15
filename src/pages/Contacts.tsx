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
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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

  const fetch = useCallback(async () => {
    const { data } = await supabase.from("contacts").select("*").order("created_at", { ascending: false });
    if (data) setContacts(data as Contact[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    supabase.from("companies").select("id, name").then(({ data }) => { if (data) setCompanies(data); });
  }, [fetch]);

  useEffect(() => {
    const ch = supabase.channel("contacts-rt").on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, () => fetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetch]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const payload = {
      first_name: fd.get("first_name") as string,
      last_name: fd.get("last_name") as string,
      email: fd.get("email") as string || null,
      phone: fd.get("phone") as string || null,
      job_title: fd.get("job_title") as string || null,
      company_id: fd.get("company_id") as string || null,
      notes: fd.get("notes") as string || null,
    };
    if (editContact) {
      const { error } = await supabase.from("contacts").update(payload).eq("id", editContact.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { setEditContact(null); setShowForm(false); fetch(); }
    } else {
      const { error } = await supabase.from("contacts").insert({ ...payload, created_by: user.id });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { setShowForm(false); fetch(); }
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("contacts").delete().eq("id", deleteId);
    setDeleteId(null);
    fetch();
  };

  const getCompanyName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? "—";

  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
  });

  const isOpen = showForm || !!editContact;

  return (
    <div className="space-y-4 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Contacts</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your contact database</p>
        </div>
        <Button onClick={() => { setEditContact(null); setShowForm(true); }} className="gap-2 btn-gradient">
          <Plus className="h-4 w-4" /> Add Contact
        </Button>
      </div>

      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

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
                  <TableHead>Job Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {c.first_name[0]}{c.last_name[0]}
                        </div>
                        {c.first_name} {c.last_name}
                      </div>
                    </TableCell>
                    <TableCell>{c.job_title ?? "—"}</TableCell>
                    <TableCell>{getCompanyName(c.company_id)}</TableCell>
                    <TableCell>{c.email ?? "—"}</TableCell>
                    <TableCell>{c.phone ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditContact(c); setShowForm(true); }} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No contacts found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={() => { setShowForm(false); setEditContact(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editContact ? "Edit Contact" : "Add Contact"}</DialogTitle>
            <DialogDescription>Fill in the contact details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name *</Label><Input name="first_name" defaultValue={editContact?.first_name ?? ""} required /></div>
              <div><Label>Last Name *</Label><Input name="last_name" defaultValue={editContact?.last_name ?? ""} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input name="email" type="email" defaultValue={editContact?.email ?? ""} /></div>
              <div><Label>Phone</Label><Input name="phone" defaultValue={editContact?.phone ?? ""} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Job Title</Label><Input name="job_title" defaultValue={editContact?.job_title ?? ""} /></div>
              <div>
                <Label>Company</Label>
                <Select name="company_id" defaultValue={editContact?.company_id ?? ""}>
                  <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notes</Label><Textarea name="notes" defaultValue={editContact?.notes ?? ""} /></div>
            <DialogFooter><Button type="submit">{editContact ? "Save" : "Add Contact"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
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
