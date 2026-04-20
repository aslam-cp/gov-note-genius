import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Image as ImageIcon, X, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DocRow {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
}

export default function UploadScreen() {
  const { caseId } = useParams({ from: "/case/$caseId/upload" });
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const { data } = await supabase
      .from("noting_documents")
      .select("id,file_name,mime_type,size_bytes,storage_path")
      .eq("case_id", caseId)
      .order("created_at");
    setDocs(data ?? []);
  };

  useEffect(() => { refresh(); }, [caseId]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const path = `${caseId}/${crypto.randomUUID()}-${f.name}`;
        const { error: upErr } = await supabase.storage
          .from("noting-docs")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) { toast.error(`Upload failed: ${f.name}`); continue; }
        const { error: insErr } = await supabase.from("noting_documents").insert({
          case_id: caseId,
          storage_path: path,
          file_name: f.name,
          mime_type: f.type || "application/octet-stream",
          size_bytes: f.size,
        });
        if (insErr) toast.error(`Could not register ${f.name}`);
      }
      await refresh();
      toast.success("Documents uploaded");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeDoc = async (d: DocRow) => {
    await supabase.storage.from("noting-docs").remove([d.storage_path]);
    await supabase.from("noting_documents").delete().eq("id", d.id);
    refresh();
  };

  const proceed = () => {
    if (docs.length === 0) { toast.error("Please upload at least one document."); return; }
    navigate({ to: "/case/$caseId/analysis", params: { caseId } });
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Home</Link>
        <h2 className="font-serif text-2xl text-primary mt-2">Upload File Documents</h2>
        <p className="text-sm text-muted-foreground">
          Add PDFs, scanned pages, screenshots, letters, Government Orders, circulars, note sheets, reports or annexures relevant to this case.
        </p>
      </div>

      <div
        className="paper p-10 border-2 border-dashed border-border text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
      >
        <Upload className="h-10 w-10 mx-auto mb-3 text-primary/70" />
        <p className="font-medium">Click to browse or drag files here</p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, PNG, JPG, WEBP — multiple files allowed
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        {uploading && (
          <p className="text-xs mt-3 text-primary flex items-center justify-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
          </p>
        )}
      </div>

      {docs.length > 0 && (
        <div className="paper p-4">
          <h3 className="font-serif text-sm uppercase tracking-wider text-muted-foreground mb-3">
            Documents on file ({docs.length})
          </h3>
          <ul className="divide-y divide-border">
            {docs.map((d) => (
              <li key={d.id} className="py-2 flex items-center gap-3">
                {d.mime_type.startsWith("image/") ? (
                  <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                )}
                <span className="flex-1 truncate text-sm">{d.file_name}</span>
                <span className="text-xs text-muted-foreground">
                  {(d.size_bytes / 1024).toFixed(0)} KB
                </span>
                <button
                  onClick={() => removeDoc(d)}
                  className="text-muted-foreground hover:text-destructive p-1"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="lg" onClick={proceed} className="gap-2">
          Proceed to Analysis <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
