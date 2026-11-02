import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { requestDownload } from "@/server/student-data";

async function triggerBrowserDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Requests a short-lived signed URL from the server (which verifies the
 * session, standing and publication status, then records the download)
 * and opens the file. Signed-out visitors are sent to /auth instead.
 */
export function DownloadButton({
  materialId,
  label = "Download",
  size = "sm",
  className,
}: {
  materialId: string;
  label?: string;
  size?: ButtonProps["size"];
  className?: string;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const start = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.info("Sign in with your student account to download.");
      await navigate({ to: "/auth", search: { redirect: "/browse" } });
      return;
    }
    setBusy(true);
    try {
      const res = await requestDownload({ data: { materialId } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      await triggerBrowserDownload(res.url);
      toast.success("Download started.");
    } catch {
      toast.error("Download failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size={size} className={className} disabled={busy} onClick={start}>
      {busy ? "Preparing…" : label}
    </Button>
  );
}
