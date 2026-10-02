"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { RebootButton } from "@/components/reboot/shared";
import { useTranslations } from "next-intl";

export function LogoutButton() {
  const t = useTranslations("account.logoutButton");
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  return (
    <RebootButton
      type="button"
      variant="outline"
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <LogOut className="size-4" />
      )}
      {t("label")}
    </RebootButton>
  );
}