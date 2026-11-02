import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary font-display text-lg font-bold text-primary-foreground">
        OP
      </span>
      <span className="font-display text-lg font-semibold uppercase tracking-wide">
        Officer<span className="text-primary-glow"> Path</span> Academy
      </span>
    </Link>
  );
}

function Header() {
  const { profile, isAdmin } = useProfile();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      await navigate({ to: "/auth", replace: true });
      router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <Link to="/" className="transition-colors hover:text-foreground">
            Home
          </Link>
          <Link to="/browse" className="transition-colors hover:text-foreground">
            Study material
          </Link>
          {profile ? (
            <>
              <Link to="/dashboard" className="transition-colors hover:text-foreground">
                Dashboard
              </Link>
              <Link to="/downloads" className="transition-colors hover:text-foreground">
                My downloads
              </Link>
              {isAdmin && (
                <Link to="/admin" className="text-primary-glow transition-colors hover:text-primary">
                  Control room
                </Link>
              )}
            </>
          ) : null}
        </nav>
        <div className="flex items-center gap-2">
          {profile ? (
            <>
              <span className="hidden text-xs text-muted-foreground sm:block">
                {profile.full_name || profile.email}
              </span>
              <Button variant="outline" size="sm" disabled={busy} onClick={signOut}>
                {busy ? "Signing out…" : "Sign out"}
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
        <Logo />
        <p>Defence exam preparation, delivered secure and simple.</p>
      </div>
    </footer>
  );
}

/** Shared shell for public pages and signed-in pages (header adapts to session). */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
