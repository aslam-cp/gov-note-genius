import { useEffect, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateNoting } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, Download, Sparkles, RefreshCw, Minus, Plus, Scale, BookText, BookMarked } from "lucide-react";
import { toast } from "sonner";

type Refinement = "shorter" | "longer" | "more_formal" | "stronger_rules" | "regenerate";
interface KB { id: string; name: string }

export default function NotingScreen() {
  const { caseId } = useParams({ from: "/case/$caseId/noting" });
  const generateFn = useServerFn(generateNoting);

  const [noting, setNoting] = useState("");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ subject: string; reference: string } | null>(null);
  const [analysis, setAnalysis] = useState<unknown>(null);
  const [notingType, setNotingType] = useState("approve");
  const [customInstruction, setCustomInstruction] = useState("");
  const [docs, setDocs] = useState<Array<{ file_name: string; mime_type: string; storage_path: string }>>([]);
  const [kbs, setKbs] = useState<KB[]>([]);
  const [appliedKbIds, setAppliedKbIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const [caseRes, docsRes, kbRes] = await Promise.all([
        supabase.from("noting_cases")
          .select("subject,reference,noting_type,custom_instruction,analysis,noting_text,applied_kb_ids")
          .eq("id", caseId).single(),
        supabase.from("noting_documents")
          .select("file_name,mime_type,storage_path").eq("case_id", caseId),
        supabase.from("knowledge_bases").select("id,name").order("name"),
      ]);
      const c = caseRes.data;
      if (c) {
        setMeta({ subject: c.subject, reference: c.reference });
        setNotingType(c.noting_type);
        setCustomInstruction(c.custom_instruction);
        setAnalysis(c.analysis);
        if (c.noting_text) setNoting(c.noting_text);
        setAppliedKbIds((c.applied_kb_ids as string[]) ?? []);
      }
      setDocs(docsRes.data ?? []);
      setKbs((kbRes.data ?? []) as KB[]);
    })();
  }, [caseId]);

  const persistKbs = async (next: string[]) => {
    setAppliedKbIds(next);
    await supabase.from("noting_cases").update({ applied_kb_ids: next }).eq("id", caseId);
  };

  const run = async (refinement: Refinement | null = null) => {
    if (!analysis) { toast.error("Analysis not available."); return; }
    setLoading(true);
    try {
      const documents = docs.map((d) => {
        const { data } = supabase.storage.from("noting-docs").getPublicUrl(d.storage_path);
        return { fileName: d.file_name, mimeType: d.mime_type, url: data.publicUrl };
      });
      const result = await generateFn({
        data: {
          documents,
          analysis,
          notingType,
          customInstruction,
          refinement,
          previousNote: noting || undefined,
          kbIds: appliedKbIds,
        },
      });
      if ("error" in result) { toast.error(result.error); return; }
      setNoting(result.noting);
      await supabase.from("noting_cases").update({ noting_text: result.noting, status: "drafted" }).eq("id", caseId);
      toast.success("Noting ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const saveEdit = async (text: string) => {
    setNoting(text);
    await supabase.from("noting_cases").update({ noting_text: text }).eq("id", caseId);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(noting);
    toast.success("Noting copied to clipboard");
  };

  const exportTxt = () => {
    const blob = new Blob(
      [`Subject: ${meta?.subject ?? ""}\nReference: ${meta?.reference ?? ""}\n\n${noting}`],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `noting-${(meta?.subject || "case").slice(0, 40).replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const KbPicker = (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5"><BookMarked className="h-3.5 w-3.5" /> Apply Knowledge Bases</Label>
        <Link to="/rule-library" className="text-xs text-muted-foreground hover:text-primary">Manage →</Link>
      </div>
      {kbs.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No knowledge bases yet. <Link to="/rule-library" className="underline">Create one</Link> to ground the noting.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {kbs.map((k) => {
            const on = appliedKbIds.includes(k.id);
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => persistKbs(on ? appliedKbIds.filter((x) => x !== k.id) : [...appliedKbIds, k.id])}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  on ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-secondary"
                }`}
              >
                {k.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/case/${caseId}/analysis` as string} className="text-sm text-muted-foreground hover:text-primary">← Analysis</Link>
        <h2 className="font-serif text-2xl text-primary mt-2">Official Noting</h2>
        {meta && (
          <p className="text-sm text-muted-foreground">
            <strong>Subject:</strong> {meta.subject} &nbsp;·&nbsp; <strong>Reference:</strong> {meta.reference}
          </p>
        )}
      </div>

      {!noting && (
        <div className="paper p-8 space-y-5">
          <div className="text-center">
            <BookText className="h-10 w-10 mx-auto mb-3 text-primary/70" />
            <p className="text-sm text-muted-foreground">
              Generate the formal noting from the perspective of the Director / CEO.
            </p>
          </div>
          {KbPicker}
          <div className="flex justify-center">
            <Button size="lg" onClick={() => run(null)} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Drafting noting…" : "Generate Noting"}
            </Button>
          </div>
        </div>
      )}

      {noting && (
        <>
          <div className="paper p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-sm uppercase tracking-wider text-muted-foreground">
                Note Sheet (editable)
              </h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copy} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
                <Button size="sm" variant="outline" onClick={exportTxt} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
              </div>
            </div>
            <Textarea
              className="noting-text min-h-[420px] bg-background"
              value={noting}
              onChange={(e) => saveEdit(e.target.value)}
            />
          </div>

          <div className="paper p-4 space-y-3">
            {KbPicker}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <RefineBtn onClick={() => run("regenerate")} loading={loading} icon={<RefreshCw className="h-3.5 w-3.5" />}>Regenerate</RefineBtn>
              <RefineBtn onClick={() => run("shorter")} loading={loading} icon={<Minus className="h-3.5 w-3.5" />}>Make Shorter</RefineBtn>
              <RefineBtn onClick={() => run("longer")} loading={loading} icon={<Plus className="h-3.5 w-3.5" />}>Make Longer</RefineBtn>
              <RefineBtn onClick={() => run("more_formal")} loading={loading} icon={<Scale className="h-3.5 w-3.5" />}>More Formal</RefineBtn>
              <RefineBtn onClick={() => run("stronger_rules")} loading={loading} icon={<BookText className="h-3.5 w-3.5" />}>Stronger Rule-Based Reasoning</RefineBtn>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RefineBtn({
  onClick, loading, icon, children,
}: { onClick: () => void; loading: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Button size="sm" variant="secondary" onClick={onClick} disabled={loading} className="gap-1.5">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </Button>
  );
}
