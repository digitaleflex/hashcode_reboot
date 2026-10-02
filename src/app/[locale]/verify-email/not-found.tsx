"use client";

import Link from "next/link";
import { Loader2, MailWarning } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { RebootButton, MonoLabel } from "@/components/reboot/shared";

export default function VerifyEmailNotFound() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-center p-4 sm:p-6">
        <Logo />
      </header>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center animate-hash-in">
          <MailWarning className="mx-auto text-destructive" size={44} />
          <MonoLabel className="mt-4 text-destructive">LIEN INVALIDE</MonoLabel>
          <h1 className="mt-2 font-display font-bold text-2xl tracking-tight">
            Ce lien ne marche plus.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground" role="alert">
            Lien expiré ou déjà utilisé. Demande un nouveau lien.
          </p>
          <div className="mt-7 flex flex-col gap-3">
            <RebootButton size="lg" className="w-full" onClick={() => (window.location.href = "/")}>
              Retourner à HASHCODE
            </RebootButton>
            <Link
              href="/login"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Se connecter
            </Link>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            Astuce : demande un nouveau lien depuis la fin de ton inscription ou ton espace.
          </p>
        </div>
      </div>
    </main>
  );
}