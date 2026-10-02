"use client";

import { ActivityLog } from "@/components/reboot/admin/ActivityLog";

export default function AdminActivityPage() {
  return (
    <div className="space-y-8">
      <section aria-label="Activité">
        <ActivityLog />
      </section>
    </div>
  );
}
