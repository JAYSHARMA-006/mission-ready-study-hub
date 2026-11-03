import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MATERIAL_SELECT = "*, exam_categories(name, slug), folders(name)";

/**
 * Issues a short-lived signed URL for a published material after verifying,
 * server-side, that the caller is an authenticated student in good standing.
 * The download is recorded and the counter incremented atomically in the DB.
 */
export const requestDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ materialId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { getPublicClient, supabaseAdmin } = await import("@/server/db.server");
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("account_status")
      .eq("id", context.userId)
      .single();
    if (!profile) {
      return { ok: false as const, message: "Profile not found." };
    }
    if (profile.account_status !== "active") {
      return {
        ok: false as const,
        message: "Your account access has been disabled. Contact the academy admin.",
      };
    }

    const { data: material } = await context.supabase
      .from("study_materials")
      .select("id, storage_path, original_file_name, title, publication_status")
      .eq("id", data.materialId)
      .single();

    if (!material) {
      return { ok: false as const, message: "Study material not found." };
    }
    if (material.publication_status !== "published") {
      return { ok: false as const, message: "This material is not available for download." };
    }

    const { error: rpcError } = await context.supabase.rpc("record_download", {
      _material_id: data.materialId,
    });
    if (rpcError) {
      return { ok: false as const, message: rpcError.message };
    }

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("study-materials")
      .createSignedUrl(material.storage_path, 300, {
        download: material.original_file_name || material.title,
      });
    if (signError || !signed) {
      return { ok: false as const, message: "Could not create a secure download link." };
    }

    return { ok: true as const, url: signed.signedUrl };
  });

export const getStudentDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getPublicClient, supabaseAdmin } = await import("@/server/db.server");
    const db = context.supabase;

    const [profileRes, recentRes, popularRes, categoriesRes, downloadsRes] = await Promise.all([
      db.from("profiles").select("*").eq("id", context.userId).single(),
      db
        .from("study_materials")
        .select(MATERIAL_SELECT)
        .eq("publication_status", "published")
        .order("created_at", { ascending: false })
        .limit(6),
      db
        .from("study_materials")
        .select(MATERIAL_SELECT)
        .eq("publication_status", "published")
        .order("download_count", { ascending: false })
        .limit(6),
      db.from("exam_categories").select("*").order("display_order"),
      db
        .from("downloads")
        .select(
          "id, downloaded_at, study_materials(id, title, original_file_name, file_type, exam_categories(name, slug))",
        )
        .order("downloaded_at", { ascending: false })
        .limit(30),
    ]);

    return {
      profile: profileRes.data ?? null,
      profileError: profileRes.error?.message ?? null,
      recentMaterials: recentRes.data ?? [],
      popularMaterials: popularRes.data ?? [],
      categories: categoriesRes.data ?? [],
      downloadHistory: downloadsRes.data ?? [],
    };
  });

export const getMyDownloads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getPublicClient, supabaseAdmin } = await import("@/server/db.server");
    const { data, error } = await context.supabase
      .from("downloads")
      .select(
        "id, downloaded_at, study_materials(id, title, original_file_name, file_type, subject, exam_categories(name, slug))",
      )
      .order("downloaded_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
