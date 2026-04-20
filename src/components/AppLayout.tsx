import { Link, Outlet } from "@tanstack/react-router";
import { FileText, Home as HomeIcon, History } from "lucide-react";

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="gov-header border-b border-primary/40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-full bg-accent/90 flex items-center justify-center text-accent-foreground font-serif text-xl font-bold shadow-elevated">
            ॐ
          </div>
          <div className="flex-1">
            <h1 className="font-serif text-xl leading-tight">
              File Noting Assistant
            </h1>
            <p className="text-xs opacity-80">
              Single-User AI Drafting Aid · For Official Use
            </p>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              to="/"
              className="px-3 py-2 rounded-md hover:bg-white/10 transition-colors flex items-center gap-1.5"
              activeOptions={{ exact: true }}
              activeProps={{ className: "px-3 py-2 rounded-md bg-white/15 flex items-center gap-1.5" }}
            >
              <HomeIcon className="h-4 w-4" /> Home
            </Link>
            <Link
              to="/new"
              className="px-3 py-2 rounded-md hover:bg-white/10 transition-colors flex items-center gap-1.5"
              activeProps={{ className: "px-3 py-2 rounded-md bg-white/15 flex items-center gap-1.5" }}
            >
              <FileText className="h-4 w-4" /> New Case
            </Link>
            <Link
              to="/history"
              className="px-3 py-2 rounded-md hover:bg-white/10 transition-colors flex items-center gap-1.5"
              activeProps={{ className: "px-3 py-2 rounded-md bg-white/15 flex items-center gap-1.5" }}
            >
              <History className="h-4 w-4" /> History
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border bg-secondary/40">
        <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-muted-foreground">
          <strong>Disclaimer:</strong> This portal is a drafting and analysis assistant only.
          Its recommendations are advisory. The final decision rests with the competent
          authority. The officer must verify rule position and factual correctness before use.
        </div>
      </footer>
    </div>
  );
}
