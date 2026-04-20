import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Plus, FileText, ArrowRight } from "lucide-react";

interface CaseRow {
  id: string;
  subject: string;
  reference: string;
  noting_type: string;
  status: string;
  updated_at: string;
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const [recent, setRecent] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sid = getSessionId();
    supabase
      .from("noting_cases")
      .select("id,subject,reference,noting_type,status,updated_at")
      .eq("session_id", sid)
      .order("updated_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setRecent(data ?? []);
        setLoading(false);
      });
  }, []);

  const startNew = async () => {
    const sid = getSessionId();
    const { data, error } = await supabase
      .from("noting_cases")
      .insert({ session_id: sid })
      .select("id")
      .single();
    if (error || !data) return;
    navigate({ to: "/case/$caseId/upload", params: { caseId: data.id } });
  };

  return (
    <div className="space-y-8">
      <section className="paper p-8 md:p-10">
        <p className="text-xs uppercase tracking-widest text-accent font-semibold mb-2">
          Government of India · Note-Sheet Assistant
        </p>
        <h2 className="font-serif text-3xl md:text-4xl text-primary mb-3">
          Draft official file notings, faster.
        </h2>
        <p className="text-muted-foreground max-w-2xl mb-6 leading-relaxed">
          Upload PDFs, scans, letters, GOs, circulars and annexures. The assistant reads
          the record, identifies issues, detects rule references, and drafts precise
          noting text in proper Government style for your file.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={startNew} className="gap-2">
            <Plus className="h-4 w-4" /> Start New Case
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/history">View History</Link>
          </Button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-xl text-primary">Recent Drafts</h3>
          <Link to="/history" className="text-sm text-primary hover:underline">
            See all →
          </Link>
        </div>
        {loading ? (
          <div className="paper p-6 text-sm text-muted-foreground">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="paper p-8 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No cases yet. Start your first case above.
          </div>
        ) : (
          <ul className="grid gap-3">
            {recent.map((c) => (
              <li key={c.id}>
                <Link
                  to="/case/$caseId/analysis"
                  params={{ caseId: c.id }}
                  className="paper p-4 flex items-center gap-4 hover:shadow-elevated transition-shadow"
                >
                  <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.reference || "No reference yet"} · {new Date(c.updated_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground capitalize">
                    {c.status}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
