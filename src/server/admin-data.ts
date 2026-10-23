import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/server/db.server";

/**
 * Every handler below first verifies, server-side, that the caller holds the
 * admin role. Frontend route guards are convenience only — these checks are
 * the real security boundary.
 */
async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error || !(data ?? []).some((r: { role: string }) => r.role === "admin")) {
    throw new Error("FORBIDDEN: Admin access required");
  }
  return context;
}

export const getCurrentUserRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if ((data ?? []).some((r: { role: string }) => r.role === "admin")) return "admin" as const;
    return "student" as const;
  });

// ---------------- overview ----------------

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      await requireAdmin(context);
    } catch {
      return null;
    }
    const admin = supabaseAdmin;
    const count = (table: string, filters?: Record<string, string>) => {
      let q = admin.from(table).select("*", { count: "exact", head: true });
      for (const [col, val] of Object.entries(filters ?? {})) q = q.eq(col, val);
      return q;
    };

    const [materials, folders, students, downloads, drafts, recent, recentStudents] =
      await Promise.all([
        count("study_materials"),
        count("folders"),
        count("profiles"),
        count("downloads"),
        count("study_materials", { publication_status: "draft" }),
        admin
          .from("study_materials")
          .select("id, title, file_type, file_size, publication_status, download_count, created_at, exam_categories(name, slug)")
          .order("created_at", { ascending: false })
          .limit(6),
        admin
          .from("profiles")
          .select("id, full_name, email, avatar_url, account_status, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    return {
      totalMaterials: materials.count ?? 0,
      totalFolders: folders.count ?? 0,
      totalStudents: students.count ?? 0,
      totalDownloads: downloads.count ?? 0,
      totalDrafts: drafts.count ?? 0,
      recentMaterials: recent.data ?? [],
      recentStudents: recentStudents.data ?? [],
    };
  });

// ---------------- folders ----------------

export const listFoldersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      await requireAdmin(context);
    } catch {
      return { ok: false as const, folders: [], categories: [] };
    }
    const [foldersRes, categoriesRes] = await Promise.all([
      supabaseAdmin.from("folders").select("*").order("name"),
      supabaseAdmin.from("exam_categories").select("*").order("display_order"),
    ]);
    return {
      ok: true as const,
      folders: foldersRes.data ?? [],
      categories: categoriesRes.data ?? [],
    };
  });

const FOLDER_SCHEMA = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(""),
  parentFolderId: z.string().uuid().nullable(),
  examCategoryId: z.string().uuid().nullable(),
});

export const saveFolder = withAdmin(async ({ data }: { data: z.infer<typeof FOLDER_SCHEMA> & { userId: string } }) =>
  undefined, // placeholder replaced below
) as any;

// The functional implementation (kept separate for clarity):
export const createFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(FOLDER_SCHEMA.omit({ id: true }))
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context);
    } catch {
      return { ok: false as const, message: "Admin access required." };
    }
    const { error } = await supabaseAdmin.from("folders").insert({
      name: data.name.trim(),
      description: data.description,
      parent_folder_id: data.parentFolderId,
      exam_category_id: data.examCategoryId,
      created_by: context.userId,
    });
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

export const updateFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(FOLDER_SCHEMA)
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context);
    } catch {
      return { ok: false as const, message: "Admin access required." };
    }
    const { error } = await supabaseAdmin
      .from("folders")
      .update({
        name: data.name.trim(),
        description: data.description,
        parent_folder_id: data.parentFolderId,
        exam_category_id: data.examCategoryId,
      })
      .eq("id", data.id!);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

export const deleteFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context);
    } catch {
      return { ok: false as const, message: "Admin access required." };
    }
    const { error } = await supabaseAdmin.from("folders").delete().eq("id", data.id);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

// ---------------- materials ----------------

const MATERIAL_SCHEMA = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(250),
  description: z.string().max(2000).default(""),
  storagePath: z.string().min(1).max(500),
  originalFileName: z.string().max(250).default(""),
  fileType: z.string().max(20).default(""),
  fileSize: z.number().int().nonnegative().default(0),
  folderId: z.string().uuid().nullable(),
  examCategoryId: z.string().uuid().nullable(),
  subject: z.string().max(120).default(""),
  topic: z.string().max(120).default(""),
  publicationStatus: z.enum(["published", "draft"]).default("draft"),
});

export const saveMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(MATERIAL_SCHEMA)
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context);
    } catch {
      return { ok: false as const, message: "Admin access required." };
    }
    const row = {
      title: data.title.trim(),
      description: data.description,
      storage_path: data.storagePath,
      original_file_name: data.originalFileName,
      file_type: data.fileType,
      file_size: data.fileSize,
      folder_id: data.folderId,
      exam_category_id: data.examCategoryId,
      subject: data.subject,
      topic: data.topic,
      publication_status: data.publicationStatus,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("study_materials").update(row).eq("id", data.id);
      if (error) return { ok: false as const, message: error.message };
      return { ok: true as const, id: data.id };
    }
    const { data: created, error } = await supabaseAdmin
      .from("study_materials")
      .insert({ ...row, created_by: context.userId })
      .select("id")
      .single();
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, id: created?.id };
  });

export const setMaterialStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["published", "draft"]) }))
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context);
    } catch {
      return { ok: false as const, message: "Admin access required." };
    }
    const { error } = await supabaseAdmin
      .from("study_materials")
      .update({ publication_status: data.status })
      .eq("id", data.id);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

export const deleteMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context);
    } catch {
      return { ok: false as const, message: "Admin access required." };
    }
    const { data: material } = await supabaseAdmin
      .from("study_materials")
      .select("storage_path")
      .eq("id", data.id)
      .single();
    const { error } = await supabaseAdmin.from("study_materials").delete().eq("id", data.id);
    if (error) return { ok: false as const, message: error.message };
    if (material?.storage_path) {
      await supabaseAdmin.storage.from("study-materials").remove([material.storage_path]);
    }
    return { ok: true as const };
  });

export type AdminMaterialQuery = {
  search?: string;
  status?: "published" | "draft";
  categoryId?: string;
  page?: number;
  pageSize?: number;
};

export const listMaterialsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    search: z.string().max(120).optional(),
    status: z.enum(["published", "draft"]).optional(),
    categoryId: z.string().uuid().optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(5).max(50).default(15),
  }))
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context);
    } catch {
      return { ok: false as const, materials: [], total: 0, page: 1, pageSize: data.pageSize };
    }
    const admin = supabaseAdmin;
    let query = admin
      .from("study_materials")
      .select("*, exam_categories(name, slug), folders(name)", { count: "exact" });
    if (data.search) {
      const term = `%${data.search}%`;
      query = query.or(`title.ilike.${term},subject.ilike.${term},topic.ilike.${term},original_file_name.ilike.${term}`);
    }
    if (data.status) query = query.eq("publication_status", data.status);
    if (data.categoryId) query = query.eq("exam_category_id", data.categoryId);

    const from = (data.page - 1) * data.pageSize;
    const { data: materials, count, error } = await query
      .order("created_at", { ascending: false })
      .range(from, from + data.pageSize - 1);
    if (error) {
      return { ok: false as const, materials: [], total: 0, page: data.page, pageSize: data.pageSize };
    }
    return {
      ok: true as const,
      materials: materials ?? [],
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

/** Short-lived signed URL so the admin can preview a stored file. */
export const adminFilePreviewUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ materialId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context);
    } catch {
      return { ok: false as const, message: "Admin access required." };
    }
    const { data: material } = await supabaseAdmin
      .from("study_materials")
      .select("storage_path, original_file_name, title")
      .eq("id", data.materialId)
      .single();
    if (!material) return { ok: false as const, message: "Material not found." };
    const { data: signed, error } = await supabaseAdmin.storage
      .from("study-materials")
      .createSignedUrl(material.storage_path, 600);
    if (error || !signed) return { ok: false as const, message: "Could not open file." };
    return { ok: true as const, url: signed.signedUrl, fileName: material.original_file_name || material.title };
  });

// ---------------- students ----------------

export const listStudentsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ search: z.string().max(120).optional() }))
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context);
    } catch {
      return { ok: false as const, students: [] };
    }
    const admin = supabaseAdmin;
    let query = admin
      .from("profiles")
      .select("id, full_name, email, avatar_url, account_status, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.search) {
      const term = `%${data.search}%`;
      query = query.or(`full_name.ilike.${term},email.ilike.${term}`);
    }
    const [{ data: students }, { data: dlRows }] = await Promise.all([
      query,
      admin.from("downloads").select("student_id"),
    ]);
    const counts = new Map<string, number>();
    for (const row of dlRows ?? []) {
      counts.set(row.student_id, (counts.get(row.student_id) ?? 0) + 1);
    }
    return {
      ok: true as const,
      students: (students ?? []).map((s) => ({ ...s, download_count: counts.get(s.id) ?? 0 })),
    };
  });

export const setStudentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ studentId: z.string().uuid(), status: z.enum(["active", "disabled"]) }))
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context);
    } catch {
      return { ok: false as const, message: "Admin access required." };
    }
    if (data.studentId === context.userId) {
      return { ok: false as const, message: "You cannot disable your own account." };
    }
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ account_status: data.status })
      .eq("id", data.studentId);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

// ---------------- settings / contact ----------------

export const listContactMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      await requireAdmin(context);
    } catch {
      return { ok: false as const, messages: [] };
    }
    const { data, error } = await supabaseAdmin
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { ok: false as const, messages: [] };
    return { ok: true as const, messages: data ?? [] };
  });

export const markContactMessageRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    try {
      await requireAdmin(context);
    } catch {
      return { ok: false as const, message: "Admin access required." };
    }
    const { error } = await supabaseAdmin
      .from("contact_messages")
      .update({ is_read: true })
      .eq("id", data.id);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

// remove placeholder export if tree-shaking complains
void saveFolder;
