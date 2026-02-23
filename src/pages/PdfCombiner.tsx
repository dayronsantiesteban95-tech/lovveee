import { useState, useCallback, useRef } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PDFDocument } from "pdf-lib";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  FileUp, Trash2, Download, GripVertical, Files, Loader2,
  ArrowUp, ArrowDown, Plus,
} from "lucide-react";

interface PdfFile {
  id: string;
  name: string;
  size: number;
  pages: number;
  bytes: ArrayBuffer;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function PdfCombiner() {
  const { toast } = useToast();
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [combining, setCombining] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const pdfs: PdfFile[] = [];
    for (const file of Array.from(fileList)) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        toast({ title: "Skipped: " + file.name, description: "Only PDF files are accepted.", variant: "destructive" });
        continue;
      }
      try {
        const bytes = await file.arrayBuffer();
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        pdfs.push({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          pages: doc.getPageCount(),
          bytes,
        });
      } catch {
        toast({ title: "Failed to read: " + file.name, description: "The file may be corrupted or password-protected.", variant: "destructive" });
      }
    }
    if (pdfs.length > 0) {
      setFiles((prev) => [...prev, ...pdfs]);
      toast({ title: `Added ${pdfs.length} PDF${pdfs.length > 1 ? "s" : ""}` });
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const clearAll = () => {
    setFiles([]);
  };

  const combinePdfs = async () => {
    if (files.length < 2) {
      toast({ title: "Need at least 2 PDFs to combine", variant: "destructive" });
      return;
    }

    setCombining(true);
    try {
      const merged = await PDFDocument.create();

      for (const file of files) {
        const source = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(source, source.getPageIndices());
        for (const page of pages) {
          merged.addPage(page);
        }
      }

      const pdfBytes = await merged.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      // Generate filename from first file
      const baseName = files[0].name.replace(/\.pdf$/i, "");
      const fileName = `${baseName}_combined_${files.length}files.pdf`;

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const totalPages = files.reduce((s, f) => s + f.pages, 0);
      toast({
        title: "PDF Combined Successfully",
        description: `${files.length} files, ${totalPages} pages total`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Combine failed", description: message, variant: "destructive" });
    } finally {
      setCombining(false);
    }
  };

  const totalPages = files.reduce((s, f) => s + f.pages, 0);
  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <ErrorBoundary>
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">PDF Combiner</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload multiple PDFs and combine them into a single document. Drag to reorder.
        </p>
      </div>

      {/* Drop zone */}
      <Card
        className={`border-2 border-dashed transition-colors cursor-pointer ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="p-3 rounded-full bg-primary/10">
            <FileUp className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              Drop PDF files here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports multiple files. Max 50MB per file.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </CardContent>
      </Card>

      {/* File list */}
      {files.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Files className="h-4 w-4" />
                {files.length} file{files.length !== 1 ? "s" : ""}
                <Badge variant="secondary" className="text-xs">
                  {totalPages} pages
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {formatSize(totalSize)}
                </Badge>
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs gap-1"
                >
                  <Plus className="h-3 w-3" /> Add More
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearAll}
                  className="text-xs text-destructive gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Clear All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {files.map((file, index) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {file.pages} page{file.pages !== 1 ? "s" : ""} -- {formatSize(file.size)}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  #{index + 1}
                </Badge>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={index === 0}
                    onClick={() => moveFile(index, -1)}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={index === files.length - 1}
                    onClick={() => moveFile(index, 1)}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeFile(file.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Combine button */}
      {files.length >= 2 && (
        <Button
          size="lg"
          className="w-full gap-2"
          onClick={combinePdfs}
          disabled={combining}
        >
          {combining ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Combining {files.length} PDFs...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Combine & Download ({totalPages} pages)
            </>
          )}
        </Button>
      )}
    </div>
    </ErrorBoundary>
  );
}
