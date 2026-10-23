import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserRoleRow = Database["public"]["Tables"]["user_roles"]["Row"];

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    setProfile(profileRes.data ?? null);
    setIsAdmin((rolesRes.data ?? []).some((r) => r.role === "admin"));
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    if (active) load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        if (event === "SIGNED_OUT") {
          setProfile(null);
          setIsAdmin(false);
          setLoading(false);
        } else {
          load();
        }
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [load]);

  return { profile, isAdmin, loading };
}
