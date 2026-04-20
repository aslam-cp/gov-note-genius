import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookMarked, Upload, Trash2, Loader2, FileText, ToggleLeft, ToggleRight, Plus, Tag } from "lucide-react";
import { toast } from "sonner";

interface RuleRow {
  id: string;
  uploader_id: string;
  title: string;
  category: string;
  reference_no: string;
  year: number | null;
  summary: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  is_active: boolean;
}

interface KB {
  id: string;
  owner_id: string | null;
  name: string;
  description: string;
}

const CATEGORIES = [
  { value: "kfc", label: "Kerala Financial Code (KFC)" },
  { value: "stores_purchase", label: "Stores Purchase Manual" },
  { value: "kpwd", label: "KPWD Manual" },
  { value: "finance_go", label: "Finance Department GO" },
  { value: "circular", label: "Circular" },
  { value: "other", label: "Other" },
];

export default function RuleLibraryScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<RuleRow[]>([]);
  const [kbs, setKbs] = useState<KB[]>([]);
  const [docKbs, setDocKbs] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: "", category: "kfc", reference_no: "", year: "", summary: "" });
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [newKbName, setNewKbName] = useState("");
  const [newKbDesc, setNewKbDesc] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const [rulesRes, kbRes, linkRes] = await Promise.all([
      supabase.from("rule_documents").select("*").order("created_at", { ascending: false }),
      supabase.from("knowledge_bases").select("id,owner_id,name,description").order("name"),
      supabase.from("rule_document_kbs").select("rule_document_id,knowledge_base_id"),
    ]);
    setRows((rulesRes.data ?? []) as RuleRow[]);
    setKbs((kbRes.data ?? []) as KB[]);
    const map: Record<string, string[]> = {};
    for (const l of (linkRes.data ?? []) as { rule_document_id: string; knowledge_base_id: string }[]) {
      (map[l.rule_document_id] ||= []).push(l.knowledge_base_id);
    }
    setDocKbs(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createKb = async () => {
    if (!user || !newKbName.trim()) return;
    const { error } = await supabase.from("knowledge_bases").insert({
      owner_id: user.id, name: newKbName.trim(), description: newKbDesc.trim(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Knowledge base created");
    setNewKbName(""); setNewKbDesc("");
    load();
  };

  const removeKb = async (kb: KB) => {
    if (!confirm(`Delete knowledge base "${kb.name}"? Documents are kept; only the grouping is removed.`)) return;
    const { error } = await supabase.from("knowledge_bases").delete().eq("id", kb.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Knowledge base deleted");
    load();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Please attach a file."); return; }
    if (!form.title.trim()) { toast.error("Title is required."); return; }
    if (!user) return;
    setUploading(true);
    try {
      const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("rule-library").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: inserted, error: insErr } = await supabase.from("rule_documents").insert({
        uploader_id: user.id,
        title: form.title,
        category: form.category,
        reference_no: form.reference_no,
        year: form.year ? Number(form.year) : null,
        summary: form.summary,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
      }).select("id").single();
      if (insErr) throw insErr;
      if (selectedKbIds.length > 0 && inserted) {
        await supabase.from("rule_document_kbs").insert(
          selectedKbIds.map((kid) => ({ rule_document_id: inserted.id, knowledge_base_id: kid })),
        );
      }
      toast.success("Rule document added to the library");
      setForm({ title: "", category: "kfc", reference_no: "", year: "", summary: "" });
      setSelectedKbIds([]);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (r: RuleRow) => {
    if (!confirm(`Remove "${r.title}" from the rule library?`)) return;
    await supabase.storage.from("rule-library").remove([r.storage_path]);
    await supabase.from("rule_documents").delete().eq("id", r.id);
    toast.success("Removed");
    load();
  };

  const toggleActive = async (r: RuleRow) => {
    await supabase.from("rule_documents").update({ is_active: !r.is_active }).eq("id", r.id);
    load();
  };

  const toggleDocKb = async (r: RuleRow, kbId: string) => {
    const has = (docKbs[r.id] ?? []).includes(kbId);
    if (has) {
      await supabase.from("rule_document_kbs")
        .delete().eq("rule_document_id", r.id).eq("knowledge_base_id", kbId);
    } else {
      await supabase.from("rule_document_kbs")
        .insert({ rule_document_id: r.id, knowledge_base_id: kbId });
    }
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Home</Link>
        <h2 className="font-serif text-2xl text-primary mt-2 flex items-center gap-2">
          <BookMarked className="h-5 w-5" /> Knowledge Bases & Rule Library
        </h2>
        <p className="text-sm text-muted-foreground">
          Create one or more named Knowledge Bases (e.g. KFC, Stores Purchase, PWD, Finance GOs).
          Tag each rule document with the knowledge bases it belongs to. On a case, pick the knowledge bases to apply.
        </p>
      </div>

      {/* Knowledge Base manager */}
      <div className="paper p-6 space-y-4">
        <h3 className="font-serif text-sm uppercase tracking-wider text-muted-foreground">Knowledge Bases</h3>
        <div className="flex flex-wrap gap-2">
          {kbs.length === 0 && <p className="text-sm text-muted-foreground italic">No knowledge bases yet.</p>}
          {kbs.map((k) => (
            <span key={k.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs">
              <Tag className="h-3 w-3" /> {k.name}
              {k.owner_id === user?.id && (
                <button onClick={() => removeKb(k)} className="ml-1 hover:text-destructive" aria-label="Delete">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-1">
            <Label>New KB name</Label>
            <Input value={newKbName} onChange={(e) => setNewKbName(e.target.value)} placeholder="e.g. KFC Vol I" />
          </div>
          <div className="md:col-span-1">
            <Label>Description (optional)</Label>
            <Input value={newKbDesc} onChange={(e) => setNewKbDesc(e.target.value)} placeholder="Short description" />
          </div>
          <div>
            <Button onClick={createKb} disabled={!newKbName.trim()} className="gap-2">
              <Plus className="h-4 w-4" /> Create KB
            </Button>
          </div>
        </div>
      </div>

      {/* Upload form */}
      <form onSubmit={submit} className="paper p-6 grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. KFC Vol. I — Chapter 7 (Contingent Charges)" />
        </div>
        <div>
          <Label>Category</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <Label>Reference No.</Label>
          <Input value={form.reference_no} onChange={(e) => setForm({ ...form, reference_no: e.target.value })} placeholder="e.g. G.O.(P) No. 123/2024/Fin" />
        </div>
        <div>
          <Label>Year</Label>
          <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2024" />
        </div>
        <div>
          <Label>Document file (PDF / image)</Label>
          <Input ref={fileRef} type="file" accept=".pdf,image/*" />
        </div>
        <div className="md:col-span-2">
          <Label>Tag with knowledge bases</Label>
          {kbs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Create a knowledge base above first.</p>
          ) : (
            <div className="flex flex-wrap gap-2 mt-1">
              {kbs.map((k) => {
                const on = selectedKbIds.includes(k.id);
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() =>
                      setSelectedKbIds((p) => on ? p.filter((x) => x !== k.id) : [...p, k.id])
                    }
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-secondary border-border"
                    }`}
                  >
                    {k.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="md:col-span-2">
          <Label>Short summary (optional, but recommended)</Label>
          <Textarea
            rows={3}
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder="One-paragraph gist — what this rule / GO governs, key thresholds, applicability."
          />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={uploading} className="gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Add to Rule Library
          </Button>
        </div>
      </form>

      {/* Library list */}
      <div className="paper p-4">
        <h3 className="font-serif text-sm uppercase tracking-wider text-muted-foreground mb-3">
          Library entries ({rows.length})
        </h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">— No rules uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const isOwner = r.uploader_id === user?.id;
              const myKbs = docKbs[r.id] ?? [];
              return (
                <li key={r.id} className="py-3 flex items-start gap-3">
                  <FileText className="h-4 w-4 text-primary shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{r.title}</p>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                        {CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category}
                      </span>
                      {!r.is_active && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.reference_no || "No ref."} {r.year ? `· ${r.year}` : ""} · {r.file_name} ({(r.size_bytes / 1024).toFixed(0)} KB)
                    </p>
                    {r.summary && <p className="text-xs mt-1 leading-relaxed">{r.summary}</p>}
                    {kbs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {kbs.map((k) => {
                          const on = myKbs.includes(k.id);
                          return (
                            <button
                              key={k.id}
                              type="button"
                              disabled={!isOwner}
                              onClick={() => toggleDocKb(r, k.id)}
                              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                              } ${isOwner ? "hover:opacity-80 cursor-pointer" : "opacity-60 cursor-not-allowed"}`}
                            >
                              {k.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {isOwner && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleActive(r)} className="text-muted-foreground hover:text-primary p-1" title={r.is_active ? "Disable" : "Enable"}>
                        {r.is_active ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5" />}
                      </button>
                      <button onClick={() => remove(r)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Remove">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
