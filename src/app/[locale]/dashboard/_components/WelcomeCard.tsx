import { getTranslations } from "next-intl/server";
import { EmojiIcon } from "@/components/reboot/emoji-icon";
import { HashSymbol } from "@/components/brand/logo";
import {
  STATUS_STYLES,
  type AccountProfile,
  type AccountStatus,
} from "@/app/[locale]/account/_components/types";

/**
 * Bandeau d'accueil du dashboard — prénom, archétype, statut, ancienneté.
 * Server component. Seul `h1` de la page (il était rendu deux fois).
 */
export async function WelcomeCard({
  firstName,
  profile,
  status,
  memberSince,
}: {
  firstName: string;
  profile: AccountProfile | null;
  status: AccountStatus;
  memberSince?: string;
}) {
  const t = await getTranslations("dashboard.home");
  const style = STATUS_STYLES[status.profileStatus];

  return (
    <header className="surface ring-gradient relative overflow-hidden rounded-[24px] p-6 sm:p-8">
      <div className="grid-radial opacity-70" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-lime/10 blur-3xl"
      />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lime to-lime/60 text-black shadow-[0_0_40px_rgba(197,244,65,0.25)]">
          {profile ? (
            <EmojiIcon emoji={profile.archetypeEmoji} className="size-7" />
          ) : (
            <HashSymbol size={28} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-bold tracking-tight text-gradient sm:text-4xl">
            {t("welcomeCard.greeting", { firstName })}
          </h1>
          {profile ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span className="font-display font-semibold italic text-lime">{profile.archetype}</span>
              <span className="text-border" aria-hidden>·</span>
              <span>{profile.domainLabel}</span>
              {memberSince && (
                <>
                  <span className="text-border" aria-hidden>·</span>
                  <span>{t("hero.memberSince", { date: memberSince })}</span>
                </>
              )}
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("welcomeCard.profileGenerating")}
            </p>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-medium sm:self-center ${style.badge}`}
        >
          <span className={`inline-block size-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>
      </div>
    </header>
  );
}
