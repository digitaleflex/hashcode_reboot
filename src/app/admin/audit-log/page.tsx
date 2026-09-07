"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AuditLogViewer } from "@/components/reboot/admin/AuditLogViewer";

export default function AdminAuditLogPage() {
  const router = useRouter();

  const handleSessionExpired = React.useCallback(() => {
    router.push("/?admin=1");
  }, [router]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-sora font-semibold text-xl text-foreground">Journal d&apos;audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historique détaillé de toutes les actions administrateur.
        </p>
      </div>

      <AuditLogViewer onSessionExpired={handleSessionExpired} />
    </div>
  );
}
