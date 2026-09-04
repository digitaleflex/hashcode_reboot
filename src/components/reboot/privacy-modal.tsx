"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { HashSymbol } from "@/components/brand/logo";
import { MonoLabel } from "./shared";

/**
 * In-page privacy modal (no separate /privacy route per the single-route
 * constraint). Triggered from the landing footer + welcome screen.
 */
export function PrivacyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto scroll-slim">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="text-lime">
              <HashSymbol size={22} />
            </span>
            <MonoLabel className="text-muted-foreground">
              Confidentialité
            </MonoLabel>
          </div>
          <DialogTitle className="font-display tracking-tight mt-2">
            Tes données. Ton profil. Ton choix.
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            HASHCODE collecte le minimum nécessaire pour comprendre ton profil
            et personnaliser ton expérience.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-5 text-sm text-foreground/90 leading-relaxed">
          <Section title="Ce qu'on collecte">
            <ul className="space-y-1.5 list-disc list-inside marker:text-lime">
              <li>Identité : prénom, email, pays. Nom, WhatsApp, ville et genre sont facultatifs.</li>
              <li>Profil : domaine, niveau, objectif, disponibilité, style d&apos;apprentissage.</li>
              <li>Mentorat : intérêt, type, fréquence, budget potentiel (seulement si tu montres un intérêt).</li>
              <li>Vision : ton objectif à 3 mois (en texte libre).</li>
            </ul>
          </Section>

          <Section title="Pourquoi on les collecte">
            <p>
              Pour te donner une première orientation, t&apos;inviter à la
              communauté au bon moment, et préparer ton futur accès au HASHCODE
              Registry. Aucune donnée n&apos;est revendue. Aucune publicité.
            </p>
          </Section>

          <Section title="Combien de temps">
            <p>
              On garde ton profil tant que tu es membre actif. Tu peux demander
              la suppression à tout moment — on efface alors toutes tes données
              sous 30 jours.
            </p>
          </Section>

          <Section title="Tes droits">
            <ul className="space-y-1.5 list-disc list-inside marker:text-lime">
              <li>Accéder à tes données.</li>
              <li>Les corriger.</li>
              <li>Les exporter.</li>
              <li>Les supprimer.</li>
              <li>Retirer ton consentement.</li>
            </ul>
            <p className="mt-2">
              Pour exercer un droit, écris à{" "}
              <span className="text-lime font-mono">
                privacy@joinhashcode.com
              </span>{" "}
              depuis l&apos;email de ton profil.
            </p>
          </Section>

          <Section title="Sécurité">
            <p>
              Validation serveur stricte, anti-doublon par email,
              rate-limiting anti-spam. Les exports admin sont réservés et
              contiennent uniquement les données membres nécessaires.
            </p>
          </Section>

          <div className="pt-3 border-t border-border/60">
            <p className="text-xs text-muted-foreground mono-label">
              HASHCODE · REBOOT — v1.0 · Édition Bénin
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-display font-semibold text-foreground mb-1.5">
        {title}
      </h3>
      <div className="text-muted-foreground text-sm">{children}</div>
    </div>
  );
}
