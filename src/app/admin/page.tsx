import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminToken } from "@/lib/admin-auth";
import { AdminDashboard } from "@/components/reboot/admin-dashboard";

/** Fallback cookie parser for server components */
function getCookieHeader(): string | undefined {
  const h = headers().get("cookie");
  if (!h) return undefined;
  const match = h.match(/(?:^|; )\s*hashcode-admin\s*=\s*([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export default async function AdminPage() {
  try {
    const token = getCookieHeader() ?? "";
    const isAuthed = verifyAdminToken(token);
    if (!isAuthed) {
      redirect("/?admin=1");
    }
    return <AdminDashboard onExit={() => {}} />;
  } catch {
    // If anything fails (e.g., ADMIN_PASSCODE missing), deny access
    redirect("/?admin=1");
  }
}