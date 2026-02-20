import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SOP_CATEGORIES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Search, Pencil, Trash2, BookOpen, LayoutGrid, List } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type SopArticle = {
  id: string;
  title: string;
  content: string;
  category: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ViewMode = "cheatsheet" | "grid";

export default function SopWiki() {
  const [articles, setArticles] = useState<SopArticle[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editArticle, setEditArticle] = useState<SopArticle | null>(null);
  const [viewArticle, setViewArticle] = useState<SopArticle | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cheatsheet");
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchArticles = useCallback(async () => {
    const { data } = await supabase
      .from("sop_articles")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setArticles(data as SopArticle[]);
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const payload = {
      title: fd.get("title") as string,
      content: fd.get("content") as string,
      category: fd.get("category") as string || "general",
    };

    if (editArticle) {
      const { error } = await supabase.from("sop_articles").update(payload).eq("id", editArticle.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { setEditArticle(null); setShowForm(false); fetchArticles(); }
    } else {
      const { error } = await supabase.from("sop_articles").insert({ ...payload, created_by: user.id });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { setShowForm(false); fetchArticles(); }
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("sop_articles").delete().eq("id", deleteId);
    setDeleteId(null);
    if (viewArticle?.id === deleteId) setViewArticle(null);
    fetchArticles();
  };

  const filtered = articles.filter((a) => {
    const q = search.toLowerCase();
    if (q && !a.title.toLowerCase().includes(q) && !a.content.toLowerCase().includes(q)) return false;
    if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
    return true;
  });

  const getCategoryLabel = (val: string) => SOP_CATEGORIES.find(c => c.value === val)?.label ?? val;

  const isFormOpen = showForm || !!editArticle;

  // Group filtered articles by category for cheat sheet view
  const groupedByCategory = SOP_CATEGORIES
    .map((cat) => ({
      ...cat,
      articles: filtered.filter((a) => a.category === cat.value),
    }))
    .filter((g) => g.articles.length > 0);

  const openCreateWithCategory = (category: string) => {
    setEditArticle(null);
    setShowForm(true);
    setCategoryFilter(category);
  };

  return (
    <div className="space-y-4 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 gradient-text">
            <BookOpen className="h-6 w-6" /> SOP Wiki
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Standard Operating Procedures -- The Anika Playbook</p>
        </div>
        <Button onClick={() => { setEditArticle(null); setShowForm(true); }} className="gap-2 btn-gradient">
          <Plus className="h-4 w-4" /> New Article
        </Button>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search articles..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          <Button variant={categoryFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter("all")}>All</Button>
          {SOP_CATEGORIES.map((c) => (
            <Button key={c.value} variant={categoryFilter === c.value ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter(c.value)}>
              {c.label}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex gap-1 border rounded-md p-0.5">
          <Button variant={viewMode === "cheatsheet" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setViewMode("cheatsheet")} title="Cheat Sheet">
            <List className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setViewMode("grid")} title="Grid View">
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-muted-foreground">No articles found. Start building your playbook!</p>
          <div className="flex flex-wrap justify-center gap-2">
            {SOP_CATEGORIES.map((c) => (
              <Button key={c.value} variant="outline" size="sm" onClick={() => openCreateWithCategory(c.value)}>
                <Plus className="h-3 w-3 mr-1" /> {c.label} procedure
              </Button>
            ))}
          </div>
        </div>
      ) : viewMode === "cheatsheet" ? (
        /* Cheat Sheet View */
        <div className="space-y-6">
          {groupedByCategory.map((group) => (
            <div key={group.value}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.label}</h2>
              <Accordion type="multiple" className="space-y-1">
                {group.articles.map((article) => (
                  <AccordionItem key={article.id} value={article.id} className="border rounded-lg px-4 bg-card">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2 text-left">
                        <span className="font-medium text-sm">{article.title}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{getCategoryLabel(article.category)}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground pb-2">
                        {article.content}
                      </div>
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <span className="text-[10px] text-muted-foreground">Updated {new Date(article.updated_at).toLocaleDateString()}</span>
                        <div className="ml-auto flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditArticle(article); setShowForm(true); }}>
                            <Pencil className="h-3 w-3 mr-1" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteId(article.id)}>
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((article) => (
            <Card
              key={article.id}
              className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
              onClick={() => setViewArticle(article)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base leading-tight">{article.title}</CardTitle>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setEditArticle(article); setShowForm(true); }} className="p-1 rounded hover:bg-muted">
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteId(article.id); }} className="p-1 rounded hover:bg-destructive/10">
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant="secondary" className="text-[10px]">{getCategoryLabel(article.category)}</Badge>
                <p className="text-xs text-muted-foreground line-clamp-3">{article.content}</p>
                <p className="text-[10px] text-muted-foreground">Updated {new Date(article.updated_at).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New/Edit Article Dialog */}
      <Dialog open={isFormOpen} onOpenChange={() => { setShowForm(false); setEditArticle(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editArticle ? "Edit Article" : "New SOP Article"}</DialogTitle>
            <DialogDescription>{editArticle ? "Update the article." : "Write a new procedure."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div><Label>Title *</Label><Input name="title" defaultValue={editArticle?.title ?? ""} required /></div>
            <div>
              <Label>Category</Label>
              <select name="category" defaultValue={editArticle?.category ?? "general"} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {SOP_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div><Label>Content *</Label><Textarea name="content" defaultValue={editArticle?.content ?? ""} required rows={8} placeholder="Write the procedure steps..." /></div>
            <DialogFooter><Button type="submit">{editArticle ? "Save Changes" : "Create Article"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Article Dialog (Grid mode only) */}
      <Dialog open={!!viewArticle} onOpenChange={() => setViewArticle(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {viewArticle && (
            <>
              <DialogHeader>
                <DialogTitle>{viewArticle.title}</DialogTitle>
                <DialogDescription>
                  <Badge variant="secondary">{getCategoryLabel(viewArticle.category)}</Badge>
                  <span className="ml-2 text-xs">Updated {new Date(viewArticle.updated_at).toLocaleDateString()}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{viewArticle.content}</div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => { setEditArticle(viewArticle); setShowForm(true); setViewArticle(null); }}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => { setDeleteId(viewArticle.id); setViewArticle(null); }}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete article?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this SOP article.</AlertDialogDescription>
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
