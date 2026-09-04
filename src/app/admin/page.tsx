"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AdminDashboard } from "@/components/reboot/admin-dashboard";
import { AdminLogin } from "@/components/reboot/admin-login";
import { HashSymbol } from "@/components/brand/logo";

export default function AdminPage() {
  const router = useRouter();
  const [state, setState] = React.useState<"checking" | "login" | "admin">(
    "checking",
  );

  React.useEffect(() => {
    fetch("/api/admin/verify", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setState(d.authed ? "admin" : "login"))
      .catch(() => setState("login"));
  }, []);

  function goHome() {
    router.push("/");
  }

  if (state === "checking") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-5">
        <HashSymbol className="text-lime" size={40} />
        <p className="mt-4 text-sm text-muted-foreground">
          Vérification de l&apos;accès…
        </p>
      </div>
    );
  }

  if (state === "login") {
    return (
      <AdminLogin onAuthed={() => setState("admin")} onExit={goHome} />
    );
  }

  return <AdminDashboard onExit={goHome} />;
}
