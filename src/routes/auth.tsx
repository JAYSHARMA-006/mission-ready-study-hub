import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserRole } from "@/server/admin-data";
import { PublicShell } from "@/components/public-shell";

type AuthSearch = { redirect?: string };

function sanitizeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    const redirect = sanitizeRedirect(search["redirect"]);
    return redirect === undefined ? {} : { redirect };
  },
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Officer Path Academy" },
      {
        name: "description",
        content: "Sign in to Officer Path Academy with Google to access defence exam study material.",
      },
      { property: "og:title", content: "Sign in — Officer Path Academy" },
      {
        property: "og:description",
        content: "Sign in to access defence exam study material and secure downloads.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AuthPage() {
  const router = useRouter();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "lovable" | "email" | null>(null);

  const navigateAfterAuth = async () => {
    let target: "/admin" | "/dashboard" = "/dashboard";
    try {
      const role = await getCurrentUserRole();
      if (role === "admin") target = "/admin";
    } catch {
      // role lookup is best-effort; students land on the dashboard
    }
    const requested = search.redirect;
    if (requested === "/admin" || requested === "/downloads" || requested === "/browse") {
      router.navigate({ to: requested });
      return;
    }
    router.navigate({ to: target });
  };

  // Already signed in (or popup sign-in just completed) -> move on.
  useEffect(() => {
    let active = true;
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && active) await navigateAfterAuth();
    };
    check();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" && active) void navigateAfterAuth();
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInOAuth = async (provider: "google" | "lovable") => {
    setBusy(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.redirected) return; // full-page flow; browser takes over
      if (result.error) toast.error(result.error.message || "Sign-in failed. Try again.");
    } catch {
      toast.error("Sign-in failed. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const signInEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("email");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await navigateAfterAuth();
  };

  return (
    <PublicShell>
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
        <Card className="glass w-full max-w-md hover-lift">
          <CardHeader className="text-center">
            <p className="section-label">Access portal</p>
            <CardTitle className="mt-2 text-3xl uppercase tracking-wide">Sign in</CardTitle>
            <CardDescription>
              Students sign in with Google. Admins sign in with the academy email account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy !== null}
              onClick={() => signInOAuth("google")}
            >
              {busy === "google" ? "Opening Google…" : "Continue with Google"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy !== null}
              onClick={() => signInOAuth("lovable")}
            >
              {busy === "lovable" ? "Connecting…" : "Continue with Lovable"}
            </Button>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs uppercase tracking-widest text-muted-foreground">or email</span>
              <Separator className="flex-1" />
            </div>
            <form onSubmit={signInEmail} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy !== null}>
                {busy === "email" ? "Signing in…" : "Sign in with email"}
              </Button>
            </form>
            <p className="text-center text-xs text-muted-foreground">
              First-time academy owner?{" "}
              <Link to="/admin-setup" className="text-primary-glow underline-offset-2 hover:underline">
                Set up the admin account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
