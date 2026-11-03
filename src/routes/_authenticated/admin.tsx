import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PublicShell } from "@/components/public-shell";
import { getAdminOverview, listMaterialsAdmin, listFoldersAdmin, createFolder, deleteFolder, saveMaterial, setMaterialStatus, deleteMaterial, adminFilePreviewUrl, listStudentsAdmin, setStudentStatus, listContactMessages, markContactMessageRead } from "@/lib/admin-data.functions";
import { fileTypeLabel, formatFileSize, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  loader: () => getAdminOverview(),
  head: () => ({
    meta: [
      { title: "Control room — Officer Path Academy" },
      { name: "description", content: "Academy admin control room." },
      { property: "og:title", content: "Control room — Officer Path Academy" },
      { property: "og:description", content: "Manage study material, folders, students and messages." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AdminPage() {
  const overview = Route.useLoaderData();

  if (!overview) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <p className="section-label">Restricted area</p>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase">Admin access required</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your account does not have admin access. If you believe this is a mistake, contact the
            academy owner.
          </p>
          <Button asChild className="mt-6">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="section-label">Control room</p>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase">Academy command</h1>

        <Tabs defaultValue="overview" className="mt-8">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="folders">Folders</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><OverviewTab overview={overview} /></TabsContent>
          <TabsContent value="materials"><MaterialsTab /></TabsContent>
          <TabsContent value="folders"><FoldersTab /></TabsContent>
          <TabsContent value="students"><StudentsTab /></TabsContent>
          <TabsContent value="messages"><MessagesTab /></TabsContent>
        </Tabs>
      </div>
    </PublicShell>
  );
}

type Overview = Awaited<ReturnType<typeof getAdminOverview>>;

function OverviewTab({ overview }: { overview: NonNullable<Overview> }) {
  const stats = [
    { label: "Materials", value: overview.totalMaterials },
    { label: "Drafts", value: overview.totalDrafts },
    { label: "Folders", value: overview.totalFolders },
    { label: "Students", value: overview.totalStudents },
    { label: "Downloads", value: overview.totalDownloads },
  ];
  return (
    <div className="mt-6 space-y-8">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="glass">
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="font-display text-3xl font-bold">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-display text-lg uppercase tracking-wide">Recent material</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overview.recentMaterials.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span className="truncate font-medium">{m.title}</span>
                <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                  {m.publication_status} · {formatDate(m.created_at)}
                </span>
              </div>
            ))}
            {overview.recentMaterials.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>
            )}
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader>
            <CardTitle className="font-display text-lg uppercase tracking-wide">New students</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overview.recentStudents.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="truncate font-medium">{s.full_name || s.email}</span>
                <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                  {s.account_status} · {formatDate(s.created_at)}
                </span>
              </div>
            ))}
            {overview.recentStudents.length === 0 && (
              <p className="text-sm text-muted-foreground">No students signed in yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------- Materials ----------------

type AdminMaterial = Awaited<ReturnType<typeof listMaterialsAdmin>>["materials"][number];

function MaterialsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "draft">("all");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin-materials", search, status, page],
    queryFn: () =>
      listMaterialsAdmin({
        data: {
          search: search || undefined,
          status: status === "all" ? undefined : status,
          page,
          pageSize: 15,
        },
      }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-materials"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const toggleStatus = async (m: AdminMaterial) => {
    const next = m.publication_status === "published" ? "draft" : "published";
    const res = await setMaterialStatus({ data: { id: m.id, status: next } });
    if (!res.ok) toast.error(res.message);
    else toast.success(next === "published" ? "Published." : "Moved to drafts.");
    invalidate();
  };

  const remove = async (m: AdminMaterial) => {
    const res = await deleteMaterial({ data: { id: m.id } });
    if (!res.ok) toast.error(res.message);
    else toast.success("Material deleted.");
    invalidate();
  };

  const preview = async (m: AdminMaterial) => {
    const res = await adminFilePreviewUrl({ data: { materialId: m.id } });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    window.open(res.url, "_blank", "noopener");
  };

  const result = query.data;
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search materials…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as "all" | "published" | "draft");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Drafts</SelectItem>
          </SelectContent>
        </Select>
        <UploadDialog onSaved={invalidate} />
      </div>

      <Card className="glass">
        <CardContent className="pt-6">
          <div className="space-y-2">
            {(result?.materials ?? []).map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.exam_categories?.name ?? "General"}
                    {m.folders ? ` · ${m.folders.name}` : ""} ·{" "}
                    {fileTypeLabel(m.file_type, m.original_file_name)} · {formatFileSize(m.file_size)} ·{" "}
                    {m.download_count} downloads
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {m.publication_status === "published" ? "Published" : "Draft"}
                  </span>
                  <Switch
                    checked={m.publication_status === "published"}
                    onCheckedChange={() => void toggleStatus(m)}
                    aria-label={`Publish or unpublish ${m.title}`}
                  />
                  <Button size="sm" variant="outline" onClick={() => void preview(m)}>
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => void remove(m)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {result && result.ok && result.materials.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No materials match this view.
              </p>
            )}
          </div>
          {result && result.ok && totalPages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-3 text-sm">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-muted-foreground">
                Page {result.page} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UploadDialog({ onSaved }: { onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [folderId, setFolderId] = useState("none");
  const [categoryId, setCategoryId] = useState("none");
  const [publishNow, setPublishNow] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const meta = useQuery({
    queryKey: ["admin-material-meta"],
    queryFn: () => listFoldersAdmin(),
    enabled: open,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    setBusy(true);
    try {
      const path = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("study-materials")
        .upload(path, file, { upsert: false });
      if (uploadError) {
        toast.error(`File upload failed: ${uploadError.message}`);
        return;
      }
      const ext = file.name.split(".").pop() ?? "";
      const res = await saveMaterial({
        data: {
          title,
          description,
          storagePath: path,
          originalFileName: file.name,
          fileType: ext.toLowerCase(),
          fileSize: file.size,
          folderId: folderId === "none" ? null : folderId,
          examCategoryId: categoryId === "none" ? null : categoryId,
          subject,
          topic,
          publicationStatus: publishNow ? "published" : "draft",
        },
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(publishNow ? "Material published." : "Saved as draft.");
      setOpen(false);
      setTitle("");
      setDescription("");
      setSubject("");
      setTopic("");
      setFile(null);
      setFolderId("none");
      setCategoryId("none");
      setPublishNow(true);
      void queryClient.invalidateQueries({ queryKey: ["admin-materials"] });
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Upload material</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-wide">Upload study material</DialogTitle>
          <DialogDescription>Files are stored securely; students download via short-lived links.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="um-title">Title</Label>
            <Input id="um-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="um-desc">Description</Label>
            <Textarea id="um-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="um-subject">Subject</Label>
              <Input id="um-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mathematics" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="um-topic">Topic</Label>
              <Input id="um-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Quadratic equations" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Exam category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(meta.data?.categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Folder</Label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(meta.data?.folders ?? []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="um-file">File</Label>
            <Input
              id="um-file"
              type="file"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="um-publish" checked={publishNow} onCheckedChange={setPublishNow} />
            <Label htmlFor="um-publish">Publish immediately</Label>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Uploading…" : "Upload material"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Folders ----------------

function FoldersTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("none");
  const [parentId, setParentId] = useState("none");
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: ["admin-folders"],
    queryFn: () => listFoldersAdmin(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-folders"] });
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await createFolder({
      data: {
        name,
        description,
        parentFolderId: parentId === "none" ? null : parentId,
        examCategoryId: categoryId === "none" ? null : categoryId,
      },
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Folder created.");
    setName("");
    setDescription("");
    invalidate();
  };

  const remove = async (id: string, folderName: string) => {
    const res = await deleteFolder({ data: { id } });
    if (!res.ok) toast.error(res.message);
    else toast.success(`Deleted ${folderName}.`);
    invalidate();
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card className="glass h-fit">
        <CardHeader>
          <CardTitle className="font-display text-lg uppercase tracking-wide">New folder</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nf-name">Name</Label>
              <Input id="nf-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nf-desc">Description</Label>
              <Input id="nf-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Exam category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(query.data?.categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Parent folder</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top level)</SelectItem>
                  {(query.data?.folders ?? []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Creating…" : "Create folder"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="font-display text-lg uppercase tracking-wide">Folders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(query.data?.folders ?? []).map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
            >
              <div>
                <p className="font-medium">{f.name}</p>
                {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => void remove(f.id, f.name)}
              >
                Delete
              </Button>
            </div>
          ))}
          {query.data && query.data.folders.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No folders yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Students ----------------

function StudentsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["admin-students", search],
    queryFn: () => listStudentsAdmin({ data: { search: search || undefined } }),
  });

  const setStatus = async (studentId: string, status: "active" | "disabled", studentName: string) => {
    const res = await setStudentStatus({ data: { studentId, status } });
    if (!res.ok) toast.error(res.message);
    else toast.success(status === "active" ? `${studentName} re-enabled.` : `${studentName} disabled.`);
    void queryClient.invalidateQueries({ queryKey: ["admin-students"] });
  };

  return (
    <Card className="glass mt-6">
      <CardHeader>
        <CardTitle className="font-display text-lg uppercase tracking-wide">Students</CardTitle>
        <CardDescription>Disable an account to immediately block its downloads.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          className="max-w-xs"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="space-y-2">
          {(query.data?.students ?? []).map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{s.full_name || s.email}</p>
                <p className="text-xs text-muted-foreground">
                  {s.email} · joined {formatDate(s.created_at)} · {s.download_count} downloads
                </p>
              </div>
              {s.account_status === "active" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => void setStatus(s.id, "disabled", s.full_name || s.email)}
                >
                  Disable
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => void setStatus(s.id, "active", s.full_name || s.email)}>
                  Re-enable
                </Button>
              )}
            </div>
          ))}
          {query.data && query.data.students.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No students found.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------- Messages ----------------

function MessagesTab() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-messages"],
    queryFn: () => listContactMessages(),
  });

  const markRead = async (id: string) => {
    const res = await markContactMessageRead({ data: { id } });
    if (!res.ok) toast.error(res.message);
    void queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
  };

  return (
    <Card className="glass mt-6">
      <CardHeader>
        <CardTitle className="font-display text-lg uppercase tracking-wide">Contact messages</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(query.data?.messages ?? []).map((m) => (
          <div key={m.id} className="rounded-lg border border-border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {m.subject || "(no subject)"} {!m.is_read && <span className="text-primary-glow">• new</span>}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{formatDate(m.created_at)}</span>
                {!m.is_read && (
                  <Button size="sm" variant="outline" onClick={() => void markRead(m.id)}>
                    Mark read
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {m.name} · {m.email}
            </p>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{m.message}</p>
          </div>
        ))}
        {query.data && query.data.messages.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No messages yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
