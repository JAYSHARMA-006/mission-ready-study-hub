import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicShell } from "@/components/public-shell";
import { DownloadButton } from "@/components/download-button";
import { getStudentDashboard } from "@/lib/student-data.functions";
import { fileTypeLabel, formatFileSize, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  loader: () => getStudentDashboard(),
  head: () => ({
    meta: [
      { title: "Dashboard — Officer Path Academy" },
      { name: "description", content: "Your study material dashboard at Officer Path Academy." },
      { property: "og:title", content: "Dashboard — Officer Path Academy" },
      { property: "og:description", content: "Latest and most-downloaded defence exam study material." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function DashboardPage() {
  const data = Route.useLoaderData();

  if (data.profileError || !data.profile) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <p className="section-label">Standby</p>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase">Setting up your profile…</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your student profile is still being created. Refresh in a moment — if this keeps
            happening, contact the academy admin.
          </p>
        </div>
      </PublicShell>
    );
  }

  const profile = data.profile;
  const name = profile.full_name || profile.email;

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="section-label">Welcome back, cadet</p>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase">
          Ready for today's session, {name.split(" ")[0]}?
        </h1>

        {/* Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard label="Material available" value={String(data.recentMaterials.length + data.popularMaterials.length > 0 ? "Curated library" : "0")} sub="Published files" />
          <StatCard label="Exam categories" value={String(data.categories.length)} sub="Tracks to follow" />
          <StatCard label="Your downloads" value={String(data.downloadHistory.length)} sub="Recent history" />
        </div>

        {/* Recent material */}
        <section className="mt-12">
          <div className="flex items-end justify-between">
            <div>
              <p className="section-label">Just published</p>
              <h2 className="mt-2 font-display text-2xl font-bold uppercase">New material</h2>
            </div>
            <Link to="/browse" className="text-sm text-primary-glow underline-offset-2 hover:underline">
              Browse all →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.recentMaterials.map((m) => (
              <Card key={m.id} className="glass hover-lift">
                <CardHeader>
                  <CardTitle className="font-display text-base uppercase tracking-wide">{m.title}</CardTitle>
                  <CardDescription>
                    {m.exam_categories?.name ?? "General"} · {fileTypeLabel(m.file_type, m.original_file_name)} ·{" "}
                    {formatFileSize(m.file_size)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DownloadButton materialId={m.id} className="w-full" size="default" />
                </CardContent>
              </Card>
            ))}
            {data.recentMaterials.length === 0 && (
              <p className="text-sm text-muted-foreground">No material published yet.</p>
            )}
          </div>
        </section>

        {/* Popular */}
        <section className="mt-12">
          <p className="section-label">Crowd favourites</p>
          <h2 className="mt-2 font-display text-2xl font-bold uppercase">Most downloaded</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.popularMaterials.map((m) => (
              <Card key={m.id} className="glass hover-lift">
                <CardHeader>
                  <CardTitle className="font-display text-base uppercase tracking-wide">{m.title}</CardTitle>
                  <CardDescription>{m.download_count} downloads · {m.exam_categories?.name ?? "General"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <DownloadButton materialId={m.id} className="w-full" size="default" />
                </CardContent>
              </Card>
            ))}
            {data.popularMaterials.length === 0 && (
              <p className="text-sm text-muted-foreground">Downloads are warming up.</p>
            )}
          </div>
        </section>

        {/* Recent history */}
        <section className="mt-12">
          <div className="flex items-end justify-between">
            <div>
              <p className="section-label">Your trail</p>
              <h2 className="mt-2 font-display text-2xl font-bold uppercase">Recent downloads</h2>
            </div>
            <Link to="/downloads" className="text-sm text-primary-glow underline-offset-2 hover:underline">
              Full history →
            </Link>
          </div>
          <div className="mt-6 space-y-2">
            {data.downloadHistory.slice(0, 8).map((d) => (
              <div
                key={d.id}
                className="glass flex items-center justify-between rounded-lg px-4 py-3 text-sm"
              >
                <span className="font-medium">{d.study_materials?.title ?? "Deleted material"}</span>
                <span className="text-muted-foreground">{formatDate(d.downloaded_at)}</span>
              </div>
            ))}
            {data.downloadHistory.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing downloaded yet — grab your first file above.</p>
            )}
          </div>
        </section>
      </div>
    </PublicShell>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="glass hover-lift">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-display text-3xl font-bold">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
