import { MousePointerClick, Compass, MessageCircle } from "lucide-react";

/**
 * Données *non textuelles* de la landing.
 *
 * Règle appliquée pendant la refonte : tout ce qui est du contenu Editorial
 * vit dans `messages/{fr,en}.json` sous `landing.*`. Ce fichier ne contient
 * plus que ce qui n'est pas traduisible — ici les icônes des 3 étapes du hero.
 *
 * Supprimés au passage (code mort depuis la refonte) : `DOMAIN_ICONS`,
 * `AXES` (désormais pilotés par `landing.axes.items`), `PILLARS`,
 * `AUDIENCE`, `COMING`, `FAQS`.
 */
export const STEPS = [
  {
    n: "01",
    icon: MousePointerClick,
  },
  {
    n: "02",
    icon: Compass,
  },
  {
    n: "03",
    icon: MessageCircle,
  },
] as const;