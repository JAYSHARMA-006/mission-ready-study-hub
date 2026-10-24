import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Integration-managed gate: client-only session check (session lives in
 * localStorage, invisible to the server), redirecting to /auth when absent.
 * Child routes need no per-page auth code.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
