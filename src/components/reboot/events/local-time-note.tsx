"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { localTimeNote } from "@/lib/events-timezone";

/**
 * Note de fuseau sous la liste des événements.
 *
 * La page affiche les horaires en heure du navigateur (voir `events/format.ts`),
 * alors que le groupe annonce ses sessions en UTC+1 (`REFERENCE_LABEL`). Un
 * visiteur hors UTC+1 voit donc une heure différente de celle annoncée : la note
 * le prévient explicitement plutôt que de laisser croire à une erreur.
 *
 * Le texte provient de `localTimeNote()`, déjà utilisé par les emails : page et
 * email ne peuvent pas se contredire. La comparaison se fait sur l'horloge
 * réellement affichée à la date de l'événement, pas sur l'identifiant de zone.
 *
 * Le fuseau du navigateur n'existe qu'après hydratation : la note est donc
 * absente du HTML rendu côté serveur et apparaît une fois le JS exécuté. C'est
 * volontaire — afficher une note dépendante du client dans le HTML serveur
 * provoquerait un écart d'hydratation.
 */
export function LocalTimeNote({ startsAt }: { startsAt?: string | undefined }) {
  const [note, setNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!startsAt) {
      setNote(null);
      return;
    }
    const date = new Date(startsAt);
    if (Number.isNaN(date.getTime())) {
      setNote(null);
      return;
    }
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setNote(localTimeNote(date, zone));
  }, [startsAt]);

  if (!note) return null;

  return (
    <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
      <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{note}</span>
    </p>
  );
}