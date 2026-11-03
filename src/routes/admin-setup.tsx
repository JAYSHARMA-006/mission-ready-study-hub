import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminExists, setupAdmin } from "@/lib/public-data.functions";
import { PublicShell } from "@/components/public-shell";

export const Route = createFileRoute("/admin-setup")({
  component: AdminSetupPage,
  loader: async () => ({ exists: await adminExists() }),
  head: () => ({
    meta: [
      { title: "Admin setup — Officer Path Academy" },
      {
        name: "description",
        content: "One-time setup for the Officer Path Academy administrator account.",
      },
      { property: "og:title", content: "Admin setup — Officer Path Academy" },
      { property: "og:description", content: "One-time setup of the academy administrator account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AdminSetupPage() {
  const { exists } = Route.useLoaderData();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await setupAdmin({ data: { email, password } });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Admin account created. Sign in to open the control room.");
    await navigate({ to: "/auth" });
  };

  return (
    <PublicShell>
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
        {exists ? (
          <Card className="glass w-full max-w-md text-center hover-lift">
            <CardHeader>
              <p className="section-label">Setup complete</p>
              <CardTitle className="mt-2 text-2xl uppercase tracking-wide">Admin already configured</CardTitle>
              <CardDescription>
                The academy admin account exists. Sign in with its email and password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/auth">Go to sign in</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass w-full max-w-md hover-lift">
            <CardHeader>
              <p className="section-label">First mission</p>
              <CardTitle className="mt-2 text-3xl uppercase tracking-wide">Admin setup</CardTitle>
              <CardDescription>
                Create the academy administrator account. This form locks itself once an admin exists.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="setup-email">Admin email</Label>
                  <Input
                    id="setup-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@academy.in"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="setup-password">Password</Label>
                  <Input
                    id="setup-password"
                    type="password"
                    required
                    minLength={10}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 10 characters"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creating admin…" : "Create admin account"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </PublicShell>
  );
}
