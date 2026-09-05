"use client";

import { useRouter } from "next/navigation";
import { AdminDashboard } from "@/components/reboot/admin-dashboard";

/** Client wrapper: owns the onExit handler (server components can't pass functions to client components). */
export function DashboardClient() {
  const router = useRouter();
  return <AdminDashboard onExit={() => router.push("/")} />;
}
