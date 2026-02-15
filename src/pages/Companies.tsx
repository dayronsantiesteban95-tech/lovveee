import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Search, Pencil, Trash2, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type Company = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  created_at: string;
};

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetch = useCallback(async () => {
    const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    if (data) setCompanies(data as Company[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    const ch = supabase.channel("companies-rt").on("postgres_changes", { event: "*", schema: "public", table: "companies" }, () => fetch()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetch]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      industry: fd.get("industry") as string || null,
      website: fd.get("website") as string || null,
      phone: fd.get("phone") as string || null,
      city: fd.get("city") as string || null,
      state: fd.get("state") as string || null,
      notes: fd.get("notes") as string || null,
    };
    if (editCompany) {
      const { error } = await supabase.from("companies").update(payload).eq("id", editCompany.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { setEditCompany(null); setShowForm(false); fetch(); }
    } else {
      const { error } = await supabase.from("companies").insert({ ...payload, created_by: user.id });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { setShowForm(false); fetch(); }
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("companies").delete().eq("id", deleteId);
    setDeleteId(null);
    fetch();
  };

  const filtered = companies.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.industry ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const isOpen = showForm || !!editCompany;

  return (
    <div className="space-y-4 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Companies</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your company database</p>
        </div>
        <Button onClick={() => { setEditCompany(null); setShowForm(true); }} className="gap-2 btn-gradient">
          <Plus className="h-4 w-4" /> Add Company
        </Button>
      </div>

      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search companies..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                  <TableHead>Company</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {c.name}
                      </div>
                    </TableCell>
                    <TableCell>{c.industry ?? "—"}</TableCell>
                    <TableCell>{[c.city, c.state].filter(Boolean).join(", ") || "—"}</TableCell>
                    <TableCell>{c.phone ?? "—"}</TableCell>
                    <TableCell>
                      {c.website ? (
                        <a href={c.website} target="_blank" rel="noreferrer" className="text-accent hover:underline text-sm">{c.website}</a>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditCompany(c); setShowForm(true); }} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No companies found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={() => { setShowForm(false); setEditCompany(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCompany ? "Edit Company" : "Add Company"}</DialogTitle>
            <DialogDescription>Fill in the company details below.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div><Label>Company Name *</Label><Input name="name" defaultValue={editCompany?.name ?? ""} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Industry</Label><Input name="industry" defaultValue={editCompany?.industry ?? ""} /></div>
              <div><Label>Phone</Label><Input name="phone" defaultValue={editCompany?.phone ?? ""} /></div>
              <div><Label>City</Label><Input name="city" defaultValue={editCompany?.city ?? ""} /></div>
              <div><Label>State</Label><Input name="state" defaultValue={editCompany?.state ?? ""} /></div>
            </div>
            <div><Label>Website</Label><Input name="website" defaultValue={editCompany?.website ?? ""} placeholder="https://" /></div>
            <div><Label>Notes</Label><Textarea name="notes" defaultValue={editCompany?.notes ?? ""} /></div>
            <DialogFooter><Button type="submit">{editCompany ? "Save" : "Add Company"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete company?</AlertDialogTitle>
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