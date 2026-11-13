import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export type LegalDocument = "terms" | "privacy" | "mentions" | "cookies";

const NAV: Record<LegalDocument, LegalDocument[]> = {
  terms: ["mentions", "privacy", "cookies"],
  privacy: ["mentions", "terms", "cookies"],
  mentions: ["privacy", "terms", "cookies"],
  cookies: ["mentions", "privacy", "terms"],
};

const SLUG: Record<LegalDocument, string> = {
  terms: "/cgu",
  privacy: "/confidentialite",
  mentions: "/mentions-legales",
  cookies: "/cookies",
};

// Informations éditeur fournies le 2026-11-13.
export const CONTACT_EMAIL = "contact@joinhashcode.com";
export const PUBLISHER_NAME = "Eurin d'ALMEIDA";
export const PUBLISHER_ADDRESS = "Abomey-Calavi, Bénin";
export const HOSTING_PROVIDER = "Hostinger";
export const PUBLICATION_DIRECTOR = "Hashcode";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="ml-5 list-disc space-y-1">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

export async function LegalDocument({ doc }: { doc: LegalDocument }) {
  const t = await getTranslations("legalPending");

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="mb-8 inline-flex min-h-[44px] items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("backHome")}
        </Link>

        <header className="mb-10">
          <span className="mono-label inline-flex items-center gap-2 rounded-sm border border-lime/40 bg-lime/5 px-2 py-0.5 text-lime">
            <span className="size-1 rounded-full bg-lime" aria-hidden />
            {t("badge")}
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {t(`docs.${doc}.title`)}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dernière mise à jour : 13 novembre 2026
          </p>
        </header>

        <article className="prose-legal">
          {doc === "mentions" && <Mentions />}
          {doc === "terms" && <Terms />}
          {doc === "privacy" && <Privacy />}
          {doc === "cookies" && <Cookies />}
        </article>

        <nav
          aria-label={t("navAria")}
          className="mt-12 border-t border-border pt-8"
        >
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {NAV[doc].map((target) => (
              <li key={target}>
                <Link
                  href={SLUG[target] as never}
                  className="inline-flex min-h-[44px] items-center text-muted-foreground transition-colors hover:text-lime"
                >
                  {t(`nav.${target}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}

function Mentions() {
  return (
    <>
      <Section title="Éditeur du site">
        <P>
          Le site HASHCODE REBOOT est édité par <strong>{PUBLISHER_NAME}</strong>,
          domicilié à {PUBLISHER_ADDRESS}.
        </P>
        <P>
          Email de contact :{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-lime underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
        </P>
        <P>
          Identifiant professionnel (SIRET / IFU / RCCM) : non communiqué — à
          compléter lors de l'immatriculation.
        </P>
      </Section>
      <Section title="Responsable de la publication">
        <P>{PUBLICATION_DIRECTOR}.</P>
      </Section>
      <Section title="Hébergement">
        <P>
          Le site est hébergé par {HOSTING_PROVIDER}. Les données sont servies
          depuis l'infrastructure de l'hébergeur, dont les coordonnées sont
          disponibles sur le site de {HOSTING_PROVIDER}.
        </P>
      </Section>
      <Section title="Propriété intellectuelle">
        <P>
          L'ensemble des contenus (textes, graphismes, logos, code source) est la
          propriété de l'éditeur, sauf mention contraire. Toute reproduction,
          représentation ou diffusion, totale ou partielle, sans autorisation
          écrite préalable est interdite.
        </P>
      </Section>
    </>
  );
}

function Terms() {
  return (
    <>
      <Section title="Objet">
        <P>
          Les présentes conditions générales d'utilisation (CGU) régissent l'accès
          et l'utilisation de la plateforme HASHCODE REBOOT, un service gratuit
          d'orientation, de profilage et de mise en relation pour les personnes
          intéressées par le développement web, la cybersécurité et l'intelligence
          artificielle.
        </P>
      </Section>
      <Section title="Accès au service">
        <P>
          L'accès à la plateforme est gratuit. Certaines fonctionnalités
          (profilage, tableau de bord, ateliers, événements) nécessitent la
          création d'un compte via une adresse email valide.
        </P>
      </Section>
      <Section title="Compte utilisateur">
        <P>
          L'utilisateur s'engage à fournir des informations exactes et à maintenir
          la confidentialité de ses identifiants. Toute utilisation frauduleuse
          du compte est de la responsabilité de l'utilisateur.
        </P>
      </Section>
      <Section title="Données personnelles">
        <P>
          Le traitement des données personnelles est décrit dans la{" "}
          <a href="/confidentialite" className="text-lime underline underline-offset-4">
            politique de confidentialité
          </a>
          . L'utilisateur dispose d'un droit d'accès, de rectification et de
          suppression de ses données.
        </P>
      </Section>
      <Section title="Responsabilité">
        <P>
          L'éditeur s'efforce de fournir des informations exactes mais ne peut
          garantir l'absence d'erreurs. L'utilisation du service se fait aux
          risques et périls de l'utilisateur.
        </P>
      </Section>
      <Section title="Modification des CGU">
        <P>
          L'éditeur se réserve le droit de modifier les présentes CGU à tout
          moment. Les utilisateurs seront informés des modifications importantes.
        </P>
      </Section>
      <Section title="Droit applicable">
        <P>
          Les présentes CGU sont soumises au droit béninois. Tout litige sera
          porté devant les tribunaux compétents d'Abomey-Calavi / Cotonou.
        </P>
      </Section>
    </>
  );
}

function Privacy() {
  return (
    <>
      <Section title="Responsable du traitement">
        <P>
          Le responsable du traitement des données personnelles est{" "}
          <strong>{PUBLISHER_NAME}</strong>, domicilié à {PUBLISHER_ADDRESS},
          contactable à{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-lime underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
          .
        </P>
      </Section>
      <Section title="Données collectées">
        <P>Nous collectons les données suivantes :</P>
        <Ul
          items={[
            "Prénom, nom, adresse email (obligatoires pour le profil)",
            "Pays, ville, domaine d'intérêt, niveau, objectifs (profilage)",
            "Numéro WhatsApp (optionnel)",
            "Données de connexion (sessions, adresse IP, agent utilisateur)",
            "Événements d'usage anonymisés (analytics)",
          ]}
        />
      </Section>
      <Section title="Finalités">
        <P>
          Les données sont utilisées pour créer et maintenir le profil de
          l'utilisateur, orienter vers des ateliers et événements adaptés,
          envoyer des communications liées au service, et améliorer la
          plateforme.
        </P>
      </Section>
      <Section title="Base légale">
        <P>
          Le traitement repose sur le consentement de l'utilisateur (profilage et
          communications) et sur l'exécution du service (compte, sessions).
        </P>
      </Section>
      <Section title="Conservation">
        <P>
          Les données sont conservées tant que le compte est actif. L'utilisateur
          peut demander la suppression de son compte et de ses données à tout
          moment via la page de suppression de compte ou par email.
        </P>
      </Section>
      <Section title="Droits de l'utilisateur">
        <P>
          Conformément à la réglementation applicable, l'utilisateur dispose
          d'un droit d'accès, de rectification, de suppression, de portabilité et
          d'opposition. Ces droits s'exercent par email à {CONTACT_EMAIL}. Un
          export complet des données est disponible depuis le tableau de bord
          (fonction « Exporter mes données »).
        </P>
      </Section>
      <Section title="Partage avec des tiers">
        <P>
          Les données ne sont jamais vendues. Elles peuvent être transmises aux
          sous-traitants techniques strictement nécessaires (hébergement,
          envoi d'emails) dans le respect de la confidentialité.
        </P>
      </Section>
    </>
  );
}

function Cookies() {
  return (
    <>
      <Section title="Qu'est-ce qu'un cookie ?">
        <P>
          Un cookie est un petit fichier texte déposé sur votre appareil lors de
          la visite du site. Il permet de mémoriser des informations sur votre
          session.
        </P>
      </Section>
      <Section title="Cookies utilisés">
        <Ul
          items={[
            "Cookie de session (authentification) — essentiel au fonctionnement",
            "Préférences d'interface (langue, thème) — fonctionnel",
            "Mesure d'audience anonymisée — statistiques d'usage",
          ]}
        />
      </Section>
      <Section title="Gestion">
        <P>
          Vous pouvez à tout moment refuser ou supprimer les cookies via les
          paramètres de votre navigateur. Le refus des cookies essentiels peut
          empêcher le bon fonctionnement du service (connexion).
        </P>
      </Section>
      <Section title="Contact">
        <P>
          Pour toute question :{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-lime underline underline-offset-4">
            {CONTACT_EMAIL}
          </a>
          .
        </P>
      </Section>
    </>
  );
}
