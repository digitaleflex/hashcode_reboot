"use client";

import * as React from "react";
import { AdminDashboard } from "@/components/reboot/admin-dashboard";

export default function AdminPage() {
  return (
    <AdminDashboard onExit={() => window.history.replaceState(null, "", "/")} />
  );
}