"use client";

import { BlacklistTable } from "@/components/reboot/admin/BlacklistTable";
import { ShieldBan } from "lucide-react";
import { MonoLabel } from "@/components/reboot/shared";

export default function BlacklistPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <ShieldBan className="size-4 text-red-400" />
          <h1 className="font-display font-bold text-xl sm:text-2xl tracking-tight">
            Blacklist email
          </h1>
        </div>
        <MonoLabel className="text-muted-foreground block">
          Emails bloqués à l'inscription. Les soft-deletes sont ajoutés
          automatiquement.
        </MonoLabel>
      </header>
      <BlacklistTable />
    </div>
  );
}
