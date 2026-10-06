"use client";

import { AuditLogViewer } from "@/components/reboot/admin/AuditLogViewer";

/**
 * D25 : ce `handleSessionExpired` et son `useRouter` sont supprimes. La
 * redirection 401 est desormais portee par `adminRequest`, et le 403 (role
 * insuffisant) s'affiche sans navigation.
 */
export default function AdminAuditLogPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-sora font-semibold text-xl text-foreground">Journal d&apos;audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historique détaillé de toutes les actions administrateur.
        </p>
      </div>

      <AuditLogViewer />
    </div>
  );
}
