import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicShell } from "@/components/public-shell";
import { DownloadButton } from "@/components/download-button";
import { getMyDownloads } from "@/server/student-data";
import { fileTypeLabel, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/downloads")({
  component: DownloadsPage,
  loader: () => getMyDownloads(),
  head: () => ({
    meta: [
      { title: "My downloads — Officer Path Academy" },
      { name: "description", content: "Your download history at Officer Path Academy." },
      { property: "og:title", content: "My downloads — Officer Path Academy" },
      { property: "og:description", content: "Every file you have downloaded, with one-click re-download." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function DownloadsPage() {
  const downloads = Route.useLoaderData();

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <p className="section-label">Supply record</p>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase">My downloads</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Every file you have pulled from the library, newest first. Re-download any time.
        </p>

        <div className="mt-8 space-y-3">
          {downloads.map((d) => (
            <Card key={d.id} className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base uppercase tracking-wide">
                  {d.study_materials?.title ?? "Deleted material"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {d.study_materials?.exam_categories?.name ?? "General"} ·{" "}
                  {fileTypeLabel(d.study_materials?.file_type, d.study_materials?.original_file_name)} ·{" "}
                  {formatDate(d.downloaded_at)}
                </span>
                {d.study_materials && (
                  <DownloadButton materialId={d.study_materials.id} label="Re-download" />
                )}
              </CardContent>
            </Card>
          ))}
          {downloads.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No downloads yet — head to the library to grab your first file.
            </p>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
