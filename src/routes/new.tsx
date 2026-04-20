import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/new")({ component: NewCase });

function NewCase() {
  const navigate = useNavigate();
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("noting_cases")
        .insert({ session_id: user.id, owner_id: user.id })
        .select("id")
        .single();
      if (data && !error) {
        navigate({ to: "/case/$caseId/upload", params: { caseId: data.id }, replace: true });
      }
    })();
  }, [navigate, user]);
  return (
    <div className="paper p-10 text-center text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Creating new case…
    </div>
  );
}
