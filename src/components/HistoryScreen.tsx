import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Row {
  id: string;
  subject: string;
  reference: string;
  status: string;
  updated_at: string;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("noting_cases")
      .select("id,subject,reference,status,updated_at")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const remove = async (id: string) => {
    if (!confirm("Delete this case and all its documents?")) return;
    await supabase.from("noting_cases").delete().eq("id", id);
    toast.success("Case deleted");
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
          ← Home
        </Link>
        <h2 className="font-serif text-2xl text-primary mt-2">Case History</h2>
        <p className="text-sm text-muted-foreground">
          All cases drafted under your officer account.
        </p>
      </div>

      {loading ? (
        <div className="paper p-6 text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="paper p-8 text-center text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No cases yet.
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((c) => (
            <li key={c.id} className="paper p-4 flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <Link
                  to="/case/$caseId/analysis"
                  params={{ caseId: c.id }}
                  className="font-medium hover:underline truncate block"
                >
                  {c.subject}
                </Link>
                <p className="text-xs text-muted-foreground truncate">
                  {c.reference || "No reference"} · {new Date(c.updated_at).toLocaleString()}
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground capitalize">
                {c.status}
              </span>
              <Button size="icon" variant="ghost" onClick={() => remove(c.id)} aria-label="Delete">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
