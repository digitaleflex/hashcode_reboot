"use client";

import * as React from "react";
import { AdminDashboard } from "@/components/reboot/admin-dashboard";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <AdminDashboard onExit={() => window.history.replaceState(null, "", "/")} />
  );
}