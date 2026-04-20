import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { analyzeCase } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { CaseAnalysis, NOTING_OPTIONS, NotingType } from "@/lib/noting-types";
import { Loader2, Sparkles, ArrowRight, AlertTriangle, CheckCircle2, FileSearch, BookMarked } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const VERDICT_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "bad" }> = {
  fit_for_approval: { label: "Fit for approval", tone: "ok" },
  not_fit: { label: "Not fit for approval", tone: "bad" },
  approve_with_conditions: { label: "May be approved subject to conditions", tone: "warn" },
  needs_clarification: { label: "Requires clarification", tone: "warn" },
  higher_authority: { label: "Requires higher-level decision", tone: "warn" },
  needs_examination: { label: "Requires further examination", tone: "warn" },
};

interface KB { id: string; name: string }

export default function AnalysisScreen() {
  const { caseId } = useParams({ from: "/case/$caseId/analysis" });
  const navigate = useNavigate();
  const analyzeFn = useServerFn(analyzeCase);

  const [docs, setDocs] = useState<Array<{ file_name: string; mime_type: string; storage_path: string }>>([]);
  const [analysis, setAnalysis] = useState<CaseAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [reference, setReference] = useState("");
  const [notingType, setNotingType] = useState<NotingType>("approve");
  const [customInstruction, setCustomInstruction] = useState("");
  const [kbs, setKbs] = useState<KB[]>([]);
  const [appliedKbIds, setAppliedKbIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const [caseRes, docsRes, kbRes] = await Promise.all([
        supabase.from("noting_cases")
          .select("subject,reference,noting_type,custom_instruction,analysis,applied_kb_ids")
          .eq("id", caseId).single(),
        supabase.from("noting_documents")
          .select("file_name,mime_type,storage_path").eq("case_id", caseId),
        supabase.from("knowledge_bases").select("id,name").order("name"),
      ]);
      const c = caseRes.data;
      if (c) {
        setSubject(c.subject || "");
        setReference(c.reference || "");
        setNotingType((c.noting_type as NotingType) || "approve");
        setCustomInstruction(c.custom_instruction || "");
        if (c.analysis) setAnalysis(c.analysis as unknown as CaseAnalysis);
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

  const runAnalysis = async () => {
    if (docs.length === 0) { toast.error("No documents found for this case."); return; }
    setLoading(true);
    try {
      const documents = docs.map((d) => {
        const { data } = supabase.storage.from("noting-docs").getPublicUrl(d.storage_path);
        return { fileName: d.file_name, mimeType: d.mime_type, url: data.publicUrl };
      });
      const result = await analyzeFn({ data: { documents, kbIds: appliedKbIds } });
      if ("error" in result) { toast.error(result.error); return; }
      const a = result.analysis as CaseAnalysis;
      setAnalysis(a);
      setSubject(a.subject);
      setReference(a.reference);
      await supabase
        .from("noting_cases")
        .update({
          subject: a.subject,
          reference: a.reference,
          context_summary: a.brief,
          analysis: a as unknown as never,
          status: "analysed",
        })
        .eq("id", caseId);
      toast.success("Analysis complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const goToNoting = async () => {
    if (!analysis) { toast.error("Please run analysis first."); return; }
    await supabase
      .from("noting_cases")
      .update({ subject, reference, noting_type: notingType, custom_instruction: customInstruction })
      .eq("id", caseId);
    navigate({ to: "/case/$caseId/noting", params: { caseId } });
  };

  const KbPicker = (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5"><BookMarked className="h-3.5 w-3.5" /> Apply Knowledge Bases</Label>
        <Link to="/rule-library" className="text-xs text-muted-foreground hover:text-primary">Manage →</Link>
      </div>
      {kbs.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No knowledge bases yet. <Link to="/rule-library" className="underline">Create one</Link> to ground reasoning in specific rules.
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
      <p className="text-[11px] text-muted-foreground">
        {appliedKbIds.length === 0
          ? "No knowledge base will be consulted. Rules will be cited only if they appear in the uploaded documents."
          : `${appliedKbIds.length} knowledge base(s) will be consulted.`}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/case/${caseId}/upload` as string} className="text-sm text-muted-foreground hover:text-primary">← Upload</Link>
        <h2 className="font-serif text-2xl text-primary mt-2">Case Analysis</h2>
        <p className="text-sm text-muted-foreground">
          The assistant will read the uploaded record and prepare a structured analysis from the perspective of the Director / CEO.
        </p>
      </div>

      {!analysis && (
        <div className="paper p-8 space-y-5">
          <div className="text-center">
            <FileSearch className="h-10 w-10 mx-auto mb-3 text-primary/70" />
            <p className="text-sm text-muted-foreground">{docs.length} document(s) on file.</p>
          </div>
          {KbPicker}
          <div className="flex justify-center">
            <Button size="lg" onClick={runAnalysis} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Analysing the file…" : "Analyse Case"}
            </Button>
          </div>
        </div>
      )}

      {analysis && (
        <>
          <div className="paper p-6 grid md:grid-cols-2 gap-4">
            <div>
              <Label>Auto-generated Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>

          <Section title="A. Brief of the Case">
            <p className="text-sm leading-relaxed">{analysis.brief}</p>
          </Section>
          <Section title="B. Key Facts on Record"><BulletList items={analysis.facts} /></Section>
          <Section title="C. Issues Requiring Consideration"><BulletList items={analysis.issues} /></Section>
          <Section title="D. Deficiencies / Gaps"><BulletList items={analysis.deficiencies} icon="warn" /></Section>
          <Section title="E. Relevant Rules / Orders / Instructions"><BulletList items={analysis.rules} /></Section>

          <div className="paper p-6">
            <h3 className="font-serif text-sm uppercase tracking-wider text-muted-foreground mb-3">F. Recommendation</h3>
            <Verdict v={analysis.verdict} />
            <p className="text-sm leading-relaxed mt-3">{analysis.recommendation}</p>
          </div>

          <div className="paper p-6 space-y-4">{KbPicker}</div>

          <div className="paper p-6 space-y-4">
            <h3 className="font-serif text-lg text-primary">Select Noting Type</h3>
            <div className="grid gap-2">
              {NOTING_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                    notingType === o.value ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="noting"
                    className="mt-1"
                    checked={notingType === o.value}
                    onChange={() => setNotingType(o.value)}
                  />
                  <div>
                    <p className="font-medium text-sm">{o.label}</p>
                    <p className="text-xs text-muted-foreground">{o.hint}</p>
                  </div>
                </label>
              ))}
            </div>
            {notingType === "other" && (
              <div>
                <Label>Custom instruction</Label>
                <Textarea
                  rows={3}
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  placeholder="E.g. Seek clarification on item 3; defer for want of funds; approve subject to PWD report; forward to Finance Wing…"
                />
              </div>
            )}
            <div className="flex justify-between gap-3">
              <Button variant="outline" onClick={runAnalysis} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Re-analyse"}
              </Button>
              <Button size="lg" onClick={goToNoting} className="gap-2">
                Generate Noting <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="paper p-6">
      <h3 className="font-serif text-sm uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function BulletList({ items, icon }: { items: string[]; icon?: "warn" }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground italic">— None recorded.</p>;
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed">
          {icon === "warn" ? (
            <AlertTriangle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          ) : (
            <span className="text-primary shrink-0">•</span>
          )}
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Verdict({ v }: { v: string }) {
  const meta = VERDICT_LABEL[v] ?? { label: v, tone: "warn" as const };
  const cls =
    meta.tone === "ok"
      ? "bg-primary/10 text-primary border-primary/30"
      : meta.tone === "bad"
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : "bg-accent/10 text-accent border-accent/30";
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${cls}`}>
      {meta.tone === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      {meta.label}
    </span>
  );
}
