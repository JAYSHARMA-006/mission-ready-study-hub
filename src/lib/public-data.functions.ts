import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

type ExamCategory = Database["public"]["Tables"]["exam_categories"]["Row"];
type StudyMaterial = Database["public"]["Tables"]["study_materials"]["Row"];
type Folder = Database["public"]["Tables"]["folders"]["Row"];

export type MaterialWithMeta = StudyMaterial & {
  exam_categories: { name: string; slug: string } | null;
  folders: { name: string } | null;
};

const MATERIAL_SELECT = "*, exam_categories(name, slug), folders(name)";

export const getExamCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClient, supabaseAdmin } = await import("@/server/db.server");
  const db = getPublicClient();
  const { data, error } = await db
    .from("exam_categories")
    .select("*")
    .order("display_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as ExamCategory[];
});

export const getLatestMaterials = createServerFn({ method: "GET" })
  .validator(z.object({ limit: z.number().int().min(1).max(12).default(6) }))
  .handler(async ({ data }) => {
    const { getPublicClient, supabaseAdmin } = await import("@/server/db.server");
    const db = getPublicClient();
    const { data: materials, error } = await db
      .from("study_materials")
      .select(MATERIAL_SELECT)
      .eq("publication_status", "published")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (materials ?? []) as MaterialWithMeta[];
  });

export type BrowseParams = {
  categoryId?: string;
  folderId?: string;
  search?: string;
  fileType?: string;
  sort?: "newest" | "oldest" | "most-downloaded";
};

export const browseMaterials = createServerFn({ method: "GET" })
  .validator(z.object({
    categoryId: z.string().uuid().optional(),
    folderId: z.string().uuid().optional(),
    search: z.string().max(120).optional(),
    fileType: z.string().max(10).optional(),
    sort: z.enum(["newest", "oldest", "most-downloaded"]).default("newest"),
  }))
  .handler(async ({ data }) => {
    const { getPublicClient, supabaseAdmin } = await import("@/server/db.server");
    const db = getPublicClient();
    let query = db
      .from("study_materials")
      .select(MATERIAL_SELECT)
      .eq("publication_status", "published");

    if (data.categoryId) query = query.eq("exam_category_id", data.categoryId);
    if (data.folderId) query = query.eq("folder_id", data.folderId);
    if (data.search) {
      const term = `%${data.search}%`;
      query = query.or(
        `title.ilike.${term},subject.ilike.${term},topic.ilike.${term},description.ilike.${term}`,
      );
    }
    if (data.fileType) query = query.ilike("file_type", data.fileType);

    query =
      data.sort === "oldest"
        ? query.order("created_at", { ascending: true })
        : data.sort === "most-downloaded"
          ? query.order("download_count", { ascending: false })
          : query.order("created_at", { ascending: false });

    const { data: materials, error } = await query.limit(100);
    if (error) throw new Error(error.message);
    return (materials ?? []) as MaterialWithMeta[];
  });

export const listFolders = createServerFn({ method: "GET" })
  .validator(z.object({ categoryId: z.string().uuid().optional() }))
  .handler(async ({ data }) => {
    const { getPublicClient, supabaseAdmin } = await import("@/server/db.server");
    const db = getPublicClient();
    let query = db.from("folders").select("*").order("name");
    if (data.categoryId) query = query.eq("exam_category_id", data.categoryId);
    const { data: folders, error } = await query;
    if (error) throw new Error(error.message);
    return (folders ?? []) as Folder[];
  });

export const getMaterialCountsByFolder = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClient, supabaseAdmin } = await import("@/server/db.server");
  const db = getPublicClient();
  const { data, error } = await db
    .from("study_materials")
    .select("folder_id")
    .eq("publication_status", "published");
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (row.folder_id) counts.set(row.folder_id, (counts.get(row.folder_id) ?? 0) + 1);
  }
  return Object.fromEntries(counts);
});

export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClient, supabaseAdmin } = await import("@/server/db.server");
  const db = getPublicClient();
  const { data, error } = await db.rpc("admin_exists");
  if (error) throw new Error(error.message);
  return data === true;
});

// ------------------------------------------------------------------
// First-time admin setup. Available only while no admin role exists;
// the form locks itself once an admin account has been created.
// ------------------------------------------------------------------
const SETUP_SCHEMA = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(72),
});

export const setupAdmin = createServerFn({ method: "POST" })
  .validator(SETUP_SCHEMA)
  .handler(async ({ data }) => {
    const { getPublicClient, supabaseAdmin } = await import("@/server/db.server");
    const admin = supabaseAdmin;
    const { count } = await admin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if (count && count > 0) {
      return { ok: false as const, message: "An admin account already exists." };
    }
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: "OPA Admin" },
    });
    if (error || !created.user) {
      return { ok: false as const, message: error?.message ?? "Could not create the admin account." };
    }
    const roleInsert = await admin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (roleInsert.error) {
      return { ok: false as const, message: `Account created but role assignment failed: ${roleInsert.error.message}` };
    }
    await admin.from("profiles").update({ full_name: "OPA Admin" }).eq("id", created.user.id);
    return { ok: true as const };
  });

export const submitContactMessage = createServerFn({ method: "POST" })
  .validator(z.object({
    name: z.string().min(1).max(120),
    email: z.string().email(),
    subject: z.string().max(200).default(""),
    message: z.string().min(1).max(4000),
  }))
  .handler(async ({ data }) => {
    const { getPublicClient, supabaseAdmin } = await import("@/server/db.server");
    const db = getPublicClient();
    const { error } = await db.from("contact_messages").insert({
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      subject: data.subject,
      message: data.message.trim(),
    });
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });
