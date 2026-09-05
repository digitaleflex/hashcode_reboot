import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminToken } from "@/lib/admin-auth";
import { DashboardClient } from "./dashboard-client";

/** Fallback cookie parser for server components */
async function getCookieHeader(): Promise<string | undefined> {
  const store = await headers();
  const h = store.get("cookie");
  if (!h) return undefined;
  const match = h.match(/(?:^|; )\s*hashcode-admin\s*=\s*([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export default async function AdminPage() {
  try {
    const token = (await getCookieHeader()) ?? "";
    const isAuthed = verifyAdminToken(token);
    if (!isAuthed) {
      redirect("/?admin=1");
    }
    return <DashboardClient />;
  } catch {
    // If anything fails (e.g., ADMIN_PASSCODE missing), deny access
    redirect("/?admin=1");
  }
}