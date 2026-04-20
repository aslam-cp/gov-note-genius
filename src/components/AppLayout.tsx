import { Link, Outlet } from "@tanstack/react-router";
import { FileText, Home as HomeIcon, History, BookMarked, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import AuthScreen from "@/components/AuthScreen";
import { Button } from "@/components/ui/button";

export default function AppLayout() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  const officerName = (user.user_metadata?.full_name as string | undefined) || user.email;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="gov-header border-b-4 border-accent">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="kerala-emblem">
            <span>GoK</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] opacity-80">
              Government of Kerala
            </p>
            <h1 className="font-serif text-lg leading-tight truncate">
              File Noting Assistant
            </h1>
          </div>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <NavLink to="/" exact icon={<HomeIcon className="h-4 w-4" />} label="Home" />
            <NavLink to="/new" icon={<FileText className="h-4 w-4" />} label="New Case" />
            <NavLink to="/history" icon={<History className="h-4 w-4" />} label="History" />
            <NavLink to="/rule-library" icon={<BookMarked className="h-4 w-4" />} label="Rule Library" />
          </nav>
          <div className="flex items-center gap-2 pl-2 border-l border-white/20">
            <span className="text-xs opacity-80 hidden lg:inline truncate max-w-[160px]">{officerName}</span>
            <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-white/10" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <nav className="md:hidden border-t border-white/20 bg-primary/95">
          <div className="max-w-6xl mx-auto px-3 py-2 flex gap-1 text-xs overflow-x-auto">
            <NavLink to="/" exact icon={<HomeIcon className="h-3.5 w-3.5" />} label="Home" />
            <NavLink to="/new" icon={<FileText className="h-3.5 w-3.5" />} label="New" />
            <NavLink to="/history" icon={<History className="h-3.5 w-3.5" />} label="History" />
            <NavLink to="/rule-library" icon={<BookMarked className="h-3.5 w-3.5" />} label="Rules" />
          </div>
        </nav>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border bg-secondary/40">
        <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Disclaimer:</strong> This portal is a drafting and analysis assistant only.
            Recommendations are advisory; the final decision rests with the competent authority.
            The officer must independently verify rule position and factual correctness.
          </p>
          <p className="opacity-70">
            Kerala Financial Code · Stores Purchase Manual · KPWD Manual · Finance Department GOs are referenced only where added by the user to the Rule Library.
          </p>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ to, icon, label, exact }: { to: string; icon: React.ReactNode; label: string; exact?: boolean }) {
  return (
    <Link
      to={to}
      className="px-3 py-2 rounded-md hover:bg-white/10 transition-colors flex items-center gap-1.5 whitespace-nowrap"
      activeOptions={exact ? { exact: true } : undefined}
      activeProps={{ className: "px-3 py-2 rounded-md bg-white/15 flex items-center gap-1.5 whitespace-nowrap" }}
    >
      {icon} {label}
    </Link>
  );
}
