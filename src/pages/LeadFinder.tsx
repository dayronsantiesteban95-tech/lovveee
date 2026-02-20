import { useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { createSequenceForLead, assignHub } from "@/lib/sequenceUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Search, Download, UserPlus, Building2, MapPin, Briefcase,
    Phone, Mail, Linkedin, Loader2, AlertCircle, CheckCircle, Play,
} from "lucide-react";

interface ZoomInfoContact {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    jobTitle: string;
    companyName: string;
    companyId: string;
    industry: string;
    city: string;
    state: string;
    companyRevenue: string;
    companyEmployeeCount: number;
    linkedinUrl: string;
}

const I10_STATES = [
    { value: "CA", label: "California" },
    { value: "AZ", label: "Arizona" },
    { value: "NM", label: "New Mexico" },
    { value: "TX", label: "Texas" },
    { value: "LA", label: "Louisiana" },
    { value: "MS", label: "Mississippi" },
    { value: "AL", label: "Alabama" },
    { value: "FL", label: "Florida" },
    { value: "GA", label: "Georgia" },
];

const INDUSTRIES = [
    "Aerospace",
    "Automotive",
    "E-commerce",
    "Healthcare",
    "Legal",
    "Manufacturing",
    "Medical Devices",
    "Pharmaceutical",
    "Retail",
    "Transportation",
];

const JOB_TITLES = [
    "Logistics Manager",
    "Supply Chain Manager",
    "Operations Manager",
    "Warehouse Manager",
    "Distribution Manager",
    "Procurement Manager",
    "Fleet Manager",
    "Transportation Director",
    "VP of Operations",
    "Director of Logistics",
];

function LeadFinder() {
    const { user } = useAuth();
    const { toast } = useToast();

    // Search filters
    const [jobTitle, setJobTitle] = useState("Logistics Manager");
    const [industry, setIndustry] = useState("Aerospace");
    const [state, setState] = useState("");
    const [city, setCity] = useState("");
    const [companyName, setCompanyName] = useState("");

    // Results
    const [contacts, setContacts] = useState<ZoomInfoContact[]>([]);
    const [totalResults, setTotalResults] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState<Set<string>>(new Set());
    const [imported, setImported] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [autoStartSequence, setAutoStartSequence] = useState(true);
    const [sequenceStarted, setSequenceStarted] = useState<Set<string>>(new Set());

    const handleSearch = async (page = 1) => {
        if (!user) return;
        setLoading(true);
        setError(null);

        try {
            const { data, error: fnError } = await supabase.functions.invoke("enrich-leads", {
                body: {
                    action: "search",
                    filters: {
                        jobTitle: jobTitle || undefined,
                        industry: industry || undefined,
                        state: state || undefined,
                        city: city || undefined,
                        companyName: companyName || undefined,
                        page,
                        pageSize: 25,
                    },
                },
            });

            if (fnError) throw new Error(fnError.message);
            if (!data?.success) throw new Error(data?.error || "Search failed");

            setContacts(data.contacts);
            setTotalResults(data.totalResults);
            setCurrentPage(page);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Search failed";
            setError(msg);
            toast({ title: "Search Error", description: msg, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (contact: ZoomInfoContact) => {
        if (!user || importing.has(contact.id)) return;

        setImporting((prev) => new Set(prev).add(contact.id));

        try {
            const { data, error: fnError } = await supabase.functions.invoke("enrich-leads", {
                body: {
                    action: "import",
                    contact_id: contact.id,
                    contact_data: contact,
                },
            });

            if (fnError) throw new Error(fnError.message);
            if (!data?.success) throw new Error(data?.error || "Import failed");

            setImported((prev) => new Set(prev).add(contact.id));

            // Auto-create nurture sequence if enabled
            const leadId = data?.lead?.id;
            if (autoStartSequence && leadId) {
                const seqOk = await createSequenceForLead(leadId, user.id);
                if (seqOk) {
                    setSequenceStarted((prev) => new Set(prev).add(contact.id));
                    const hub = assignHub(contact.state, contact.city);
                    toast({
                        title: "?? Lead Imported + Sequence Started",
                        description: `${contact.firstName} ${contact.lastName} from ${contact.companyName} -> Hub: ${hub.charAt(0).toUpperCase() + hub.slice(1)} -> 3-step outreach created. Email #1 will auto-send.`,
                    });
                } else {
                    toast({
                        title: "Lead Imported (sequence failed)",
                        description: `${contact.companyName} was imported, but the sequence could not be started. Start it manually in the Nurture Engine.`,
                        variant: "destructive",
                    });
                }
            } else {
                toast({
                    title: "Lead Imported",
                    description: `${contact.firstName} ${contact.lastName} from ${contact.companyName} added to pipeline.`,
                });
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Import failed";
            toast({ title: "Import Error", description: msg, variant: "destructive" });
        } finally {
            setImporting((prev) => {
                const next = new Set(prev);
                next.delete(contact.id);
                return next;
            });
        }
    };

    const handleImportAll = async () => {
        const unimported = contacts.filter((c) => !imported.has(c.id));
        for (const contact of unimported) {
            await handleImport(contact);
        }
    };

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Search className="h-6 w-6 text-accent" />
                        <span className="gradient-text">Lead Finder</span>
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Search ZoomInfo for decision-makers and import them directly into your pipeline.
                    </p>
                </div>
                {totalResults > 0 && (
                    <Badge variant="secondary" className="text-sm px-3 py-1">
                        {totalResults.toLocaleString()} results found
                    </Badge>
                )}
            </div>

            {/* Search Filters */}
            <Card className="border-accent/20 hover-lift">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        Search Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Job Title */}
                        <div className="space-y-2">
                            <Label htmlFor="jobTitle">Job Title</Label>
                            <Select value={jobTitle} onValueChange={setJobTitle}>
                                <SelectTrigger id="jobTitle">
                                    <SelectValue placeholder="Select job title" />
                                </SelectTrigger>
                                <SelectContent>
                                    {JOB_TITLES.map((t) => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Industry */}
                        <div className="space-y-2">
                            <Label htmlFor="industry">Industry</Label>
                            <Select value={industry} onValueChange={setIndustry}>
                                <SelectTrigger id="industry">
                                    <SelectValue placeholder="Select industry" />
                                </SelectTrigger>
                                <SelectContent>
                                    {INDUSTRIES.map((i) => (
                                        <SelectItem key={i} value={i}>{i}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* State (I-10 Corridor) */}
                        <div className="space-y-2">
                            <Label htmlFor="state">State (I-10 Corridor)</Label>
                            <Select value={state} onValueChange={setState}>
                                <SelectTrigger id="state">
                                    <SelectValue placeholder="All states" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All States</SelectItem>
                                    {I10_STATES.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* City */}
                        <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <Input
                                id="city"
                                placeholder="e.g., Phoenix, Los Angeles"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                            />
                        </div>

                        {/* Company Name */}
                        <div className="space-y-2">
                            <Label htmlFor="companyName">Company Name</Label>
                            <Input
                                id="companyName"
                                placeholder="e.g., Boeing, Raytheon"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                            />
                        </div>

                        {/* Search Button */}
                        <div className="flex items-end">
                            <Button
                                onClick={() => handleSearch(1)}
                                disabled={loading}
                                className="w-full btn-gradient text-white"
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Search className="h-4 w-4 mr-2" />
                                )}
                                Search ZoomInfo
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Error */}
            {error && (
                <Card className="border-red-500/50 bg-red-500/5">
                    <CardContent className="flex items-center gap-3 py-4">
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-red-500">Search Error</p>
                            <p className="text-sm text-muted-foreground">{error}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Loading Skeleton */}
            {loading && (
                <Card>
                    <CardContent className="py-6 space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <Skeleton className="h-10 w-10 rounded-full shimmer" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-48" />
                                    <Skeleton className="h-3 w-32" />
                                </div>
                                <Skeleton className="h-9 w-24" />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Results Table */}
            {!loading && contacts.length > 0 && (
                <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Search Results</CardTitle>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="auto-sequence"
                                    checked={autoStartSequence}
                                    onCheckedChange={setAutoStartSequence}
                                    className="scale-90"
                                />
                                <Label htmlFor="auto-sequence" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                                    <Play className="h-3 w-3" />
                                    Auto-start nurture sequence
                                </Label>
                            </div>
                            <Button
                                onClick={handleImportAll}
                                variant="outline"
                                size="sm"
                                disabled={imported.size === contacts.length}
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Import All ({contacts.length - imported.size})
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[500px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Contact</TableHead>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Company</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Contact Info</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {contacts.map((contact) => (
                                        <TableRow key={contact.id} className="group">
                                            <TableCell>
                                                <div className="font-medium">
                                                    {contact.firstName} {contact.lastName}
                                                </div>
                                                {contact.linkedinUrl && (
                                                    <a
                                                        href={contact.linkedinUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-500 hover:text-blue-400 inline-flex items-center gap-1 text-xs mt-0.5"
                                                    >
                                                        <Linkedin className="h-3 w-3" /> LinkedIn
                                                    </a>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm">{contact.jobTitle}</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <span className="text-sm font-medium">{contact.companyName}</span>
                                                </div>
                                                {contact.industry && (
                                                    <Badge variant="outline" className="text-xs mt-1">
                                                        {contact.industry}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                                    {[contact.city, contact.state].filter(Boolean).join(", ")}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    {contact.email && (
                                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                            <Mail className="h-3 w-3" />
                                                            {contact.email}
                                                        </div>
                                                    )}
                                                    {contact.phone && (
                                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                            <Phone className="h-3 w-3" />
                                                            {contact.phone}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {imported.has(contact.id) ? (
                                                    <div className="flex items-center gap-2 justify-end">
                                                        {sequenceStarted.has(contact.id) && (
                                                            <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-600">
                                                                <Play className="h-2.5 w-2.5 mr-0.5" />
                                                                Sequence active
                                                            </Badge>
                                                        )}
                                                        <Badge className="bg-green-600">
                                                            <CheckCircle className="h-3 w-3 mr-1" />
                                                            Imported
                                                        </Badge>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleImport(contact)}
                                                        disabled={importing.has(contact.id)}
                                                        className="bg-accent hover:bg-accent/90"
                                                    >
                                                        {importing.has(contact.id) ? (
                                                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                                        ) : (
                                                            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                                                        )}
                                                        Import
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>

                    {/* Pagination */}
                    {totalResults > 25 && (
                        <div className="flex items-center justify-between px-6 py-3 border-t">
                            <p className="text-sm text-muted-foreground">
                                Page {currentPage} of {Math.ceil(totalResults / 25)}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSearch(currentPage - 1)}
                                    disabled={currentPage <= 1 || loading}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSearch(currentPage + 1)}
                                    disabled={currentPage >= Math.ceil(totalResults / 25) || loading}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* Empty State */}
            {!loading && contacts.length === 0 && !error && (
                <Card className="border-dashed hover-lift">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <Search className="h-12 w-12 text-muted-foreground/30 mb-4 animate-float" />
                        <h3 className="text-lg font-semibold mb-1">Search for Leads</h3>
                        <p className="text-muted-foreground max-w-md">
                            Use the filters above to search ZoomInfo for decision-makers.
                            Default filters are set to "Logistics Manager" at "Aerospace" firms -- perfect for the I-10 corridor run.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export default function LeadFinderPage() {
  return (
    <ErrorBoundary>
      <LeadFinder />
    </ErrorBoundary>
  );
}
