import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HardHat, Leaf, Trash2, ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign In — NagarMitra" },
      {
        name: "description",
        content:
          "One app for the city: residents report waste and track it, field workers sign in with ward-issued credentials to clear jobs.",
      },
      { property: "og:title", content: "Sign In — NagarMitra" },
      {
        property: "og:description",
        content: "Residents report waste. Field workers clear it. One app.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Persona = "citizen" | "worker" | null;

function AuthPage() {
  const navigate = useNavigate();
  const [persona, setPersona] = useState<Persona>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [existingEmail, setExistingEmail] = useState<string | null>(null);


  const routeByRole = useCallback(
    async (userId: string) => {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const isStaff = (roles ?? []).some(
        (r) => r.role === "commissioner" || r.role === "zonal_officer",
      );
      const isWorker = (roles ?? []).some((r) => r.role === "worker");
      navigate({ to: isStaff ? "/overview" : isWorker ? "/staff" : "/app" });
    },
    [navigate],
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setExistingEmail(data.session.user.email ?? "your account");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void routeByRole(session.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [routeByRole]);

  async function continueSession() {
    const { data } = await supabase.auth.getSession();
    if (data.session) void routeByRole(data.session.user.id);
    else setExistingEmail(null);
  }

  async function switchAccount() {
    await supabase.auth.signOut();
    setExistingEmail(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // Never sign in on top of a stale session — it can route to the previous
      // account's dashboard.
      const { data: current } = await supabase.auth.getSession();
      if (current.session && current.session.user.email !== email) {
        await supabase.auth.signOut();
        setExistingEmail(null);
      }
      if (persona === "citizen" && mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, account_type: "citizen" },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Account created. Check your email to confirm it, then sign in.");
          setMode("signin");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }


  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error("Google sign-in failed. Try again.");
  }

  const isWorker = persona === "worker";

  return (
    <div
      className={cn(
        "flex min-h-screen items-center justify-center px-4 py-12 transition-colors",
        isWorker ? "field-theme bg-background" : "bg-background",
      )}
    >
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            {isWorker ? <HardHat className="h-7 w-7" /> : <Trash2 className="h-7 w-7" />}
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">NagarMitra</h1>
          <p className="text-sm text-muted-foreground">
            {isWorker
              ? "Field crew sign-in"
              : "Your city partner for clean streets"}
          </p>
        </div>

        {existingEmail ? (
          <div className="card-surface mb-4 p-4">
            <p className="text-sm">
              You are already signed in as <span className="font-semibold">{existingEmail}</span>.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={continueSession}
                className="h-10 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
              >
                Continue
              </button>
              <button
                onClick={switchAccount}
                className="h-10 flex-1 rounded-xl border border-border text-sm font-semibold hover:bg-accent"
              >
                Use another account
              </button>
            </div>
          </div>
        ) : null}

        {persona === null ? (
          <div className="card-surface animate-in fade-in slide-in-from-bottom-2 p-6 duration-300">
            <h2 className="font-display text-lg font-semibold">How are you using NagarMitra?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick one to continue. You can switch later by signing out.
            </p>

            <div className="mt-5 space-y-3">
              <button
                onClick={() => {
                  setPersona("citizen");
                  setMode("signin");
                }}
                className="flex w-full items-center gap-4 rounded-2xl border-[1.5px] border-border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Leaf className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">I am a resident</span>
                  <span className="block text-sm text-muted-foreground">
                    Report waste and track it until it is cleared
                  </span>
                </span>
              </button>

              <button
                onClick={() => {
                  setPersona("worker");
                  setMode("signin");
                }}
                className="flex w-full items-center gap-4 rounded-2xl border-[1.5px] border-border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground">
                  <HardHat className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">I am a field worker</span>
                  <span className="block text-sm text-muted-foreground">
                    Sign in with the credentials your ward office gave you
                  </span>
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="card-surface animate-in fade-in slide-in-from-bottom-2 p-6 duration-300">
            <button
              onClick={() => {
                setPersona(null);
                setPassword("");
              }}
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            <h2 className="font-display text-lg font-semibold">
              {isWorker
                ? "Worker sign-in"
                : mode === "signin"
                  ? "Welcome back"
                  : "Create your account"}
            </h2>

            {isWorker ? (
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                Worker accounts are created by the ward office. Use the email and password issued to
                you.
              </p>
            ) : null}

            <form onSubmit={submit} className="mt-5 space-y-4">
              {!isWorker && mode === "signup" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="name">
                    Full name
                  </label>
                  <input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-11 w-full rounded-[10px] border border-input bg-card px-4 text-sm outline-none transition-shadow focus:border-primary focus:ring-[3px] focus:ring-primary/20"
                    placeholder="Meera Iyer"
                    required
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 w-full rounded-[10px] border border-input bg-card px-4 text-sm outline-none transition-shadow focus:border-primary focus:ring-[3px] focus:ring-primary/20"
                  placeholder={isWorker ? "worker.id@ward.gov" : "you@example.com"}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-[10px] border border-input bg-card px-4 text-sm outline-none transition-shadow focus:border-primary focus:ring-[3px] focus:ring-primary/20"
                  minLength={6}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-40"
              >
                {busy
                  ? "Please wait…"
                  : isWorker
                    ? "Sign in to field app"
                    : mode === "signin"
                      ? "Sign in"
                      : "Create account"}
              </button>
            </form>

            {!isWorker ? (
              <>
                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>

                <button
                  onClick={google}
                  className="h-12 w-full rounded-xl border-[1.5px] border-primary bg-card text-[15px] font-semibold transition-colors hover:bg-accent"
                >
                  Continue with Google
                </button>

                <p className="mt-5 text-center text-sm text-muted-foreground">
                  {mode === "signin" ? "No account yet?" : "Already registered?"}{" "}
                  <button
                    className="font-semibold text-foreground underline"
                    onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                  >
                    {mode === "signin" ? "Create one" : "Sign in"}
                  </button>
                </p>
              </>
            ) : (
              <p className="mt-5 text-center text-sm text-muted-foreground">
                Lost your credentials? Contact your ward supervisor.
              </p>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          NagarMitra — residents report, field crews clear, the city stays clean.
        </p>
      </div>
    </div>
  );
}
