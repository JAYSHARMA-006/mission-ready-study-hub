import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PublicShell } from "@/components/public-shell";
import { DownloadButton } from "@/components/download-button";
import { getExamCategories, listFolders, browseMaterials, getMaterialCountsByFolder } from "@/lib/public-data.functions";
import { fileTypeLabel, formatFileSize, formatDate } from "@/lib/format";

type BrowseSearch = {
  categoryId?: string;
  folderId?: string;
  q?: string;
  fileType?: string;
  sort?: "newest" | "oldest" | "most-downloaded";
};

export const Route = createFileRoute("/browse")({
  validateSearch: (search: Record<string, unknown>): BrowseSearch => {
    const out: Record<string, unknown> = {};
    if (typeof search["categoryId"] === "string" && search["categoryId"]) out["categoryId"] = search["categoryId"];
    if (typeof search["folderId"] === "string" && search["folderId"]) out["folderId"] = search["folderId"];
    if (typeof search["q"] === "string" && search["q"]) out["q"] = search["q"];
    if (typeof search["fileType"] === "string" && search["fileType"]) out["fileType"] = search["fileType"];
    const sort = search["sort"];
    if (sort === "oldest" || sort === "most-downloaded") out["sort"] = sort;
    return out;
  },
  component: BrowsePage,
  loader: async () => {
    const [categories, folders, counts] = await Promise.all([
      getExamCategories(),
      listFolders({ data: {} }),
      getMaterialCountsByFolder(),
    ]);
    return { categories, folders, counts };
  },
  head: () => ({
    meta: [
      { title: "Study material — Officer Path Academy" },
      {
        name: "description",
        content: "Browse and download curated study material for NDA, CDS, AFCAT and other defence exams.",
      },
      { property: "og:title", content: "Study material — Officer Path Academy" },
      {
        property: "og:description",
        content: "Browse and download defence exam notes, papers and practice sets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function BrowsePage() {
  const { categories, folders, counts } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setParam = (patch: Record<string, unknown>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const materialsQuery = useQuery({
    queryKey: ["browse-materials", search],
    queryFn: () =>
      browseMaterials({
        data: {
          categoryId: search.categoryId,
          folderId: search.folderId,
          search: search.q,
          fileType: search.fileType,
          sort: search.sort ?? "newest",
        },
      }),
  });

  const materials = materialsQuery.data ?? [];
  const visibleFolders = search.categoryId
    ? folders.filter((f) => f.exam_category_id === search.categoryId)
    : folders;

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="section-label">Library</p>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase">Study material</h1>

        {/* Filters */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            placeholder="Search notes, papers…"
            defaultValue={search.q}
            onKeyDown={(e) => {
              if (e.key === "Enter") setParam({ q: (e.target as HTMLInputElement).value || undefined });
            }}
          />
          <Select
            value={search.categoryId ?? "all"}
            onValueChange={(v) => setParam({ categoryId: v === "all" ? undefined : v, folderId: undefined })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Exam" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All exams</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={search.folderId ?? "all"}
            onValueChange={(v) => setParam({ folderId: v === "all" ? undefined : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All folders</SelectItem>
              {visibleFolders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name} ({counts[f.id] ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={search.fileType ?? "all"}
            onValueChange={(v) => setParam({ fileType: v === "all" ? undefined : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {["pdf", "docx", "pptx", "xlsx", "zip", "jpg", "png"].map((t) => (
                <SelectItem key={t} value={t}>
                  {t.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={search.sort ?? "newest"}
            onValueChange={(v) => setParam({ sort: v === "newest" ? undefined : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="most-downloaded">Most downloaded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((m) => (
            <Card key={m.id} className="glass hover-lift flex flex-col">
              <CardHeader>
                <CardTitle className="font-display text-base uppercase tracking-wide">{m.title}</CardTitle>
                <CardDescription>
                  {m.exam_categories?.name ?? "General"}
                  {m.folders ? ` · ${m.folders.name}` : ""}
                  {m.subject ? ` · ${m.subject}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                {m.description && <p className="line-clamp-2 text-sm text-muted-foreground">{m.description}</p>}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {fileTypeLabel(m.file_type, m.original_file_name)} · {formatFileSize(m.file_size)} ·{" "}
                    {m.download_count} downloads
                  </span>
                  <span>{formatDate(m.created_at)}</span>
                </div>
                <DownloadButton materialId={m.id} className="w-full" size="default" />
              </CardContent>
            </Card>
          ))}
        </div>
        {materials.length === 0 && !materialsQuery.isLoading && (
          <div className="mt-10 text-center">
            <p className="text-muted-foreground">Nothing matches these filters yet.</p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/browse">Clear filters</Link>
            </Button>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
