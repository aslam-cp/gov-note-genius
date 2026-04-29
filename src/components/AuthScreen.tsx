import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Account created. You are signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="gov-header py-6 border-b-4 border-accent">
        <div className="max-w-3xl mx-auto px-6 flex items-center gap-4">
          <div className="kerala-emblem">
            <span>കേ</span>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] opacity-80">
              സർക്കാർ · Government of Kerala
            </p>
            <h1 className="font-serif text-xl leading-tight">
              ഫയൽ കുറിപ്പ് സഹായി · File Noting Assistant
            </h1>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="paper p-8 w-full max-w-md">
          <div className="flex items-center gap-2 mb-1 text-accent">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-xs uppercase tracking-widest font-semibold">
              For Official Use Only
            </span>
          </div>
          <h2 className="font-serif text-2xl text-primary mb-1">
            {mode === "login" ? "Officer Sign In" : "Create Officer Account"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "login"
              ? "Sign in with your official email to access the drafting workspace."
              : "Register your official email to begin using the file noting assistant."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Officer name (designation)</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sri/Smt. Name, Designation"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Official email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@kerala.gov.in"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters.</p>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "login" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                New officer?{" "}
                <button className="text-primary hover:underline" onClick={() => setMode("signup")}>
                  Create account
                </button>
              </>
            ) : (
              <>
                Already registered?{" "}
                <button className="text-primary hover:underline" onClick={() => setMode("login")}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
