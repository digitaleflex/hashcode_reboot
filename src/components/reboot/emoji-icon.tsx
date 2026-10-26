import {
  Bot,
  Brain,
  Briefcase,
  CloudSun,
  Cog,
  Compass,
  Globe,
  GraduationCap,
  Hammer,
  Handshake,
  Landmark,
  Lightbulb,
  Luggage,
  Palette,
  Puzzle,
  RefreshCw,
  Rocket,
  ScrollText,
  Search,
  Shield,
  Sparkles,
  Sprout,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Emojis de `lib/profiling` (questions + archétypes) → icônes Lucide.
 *
 * Les emojis restent la source (données partagées avec les emails et le
 * moteur) ; l'UI les traduit en icônes vectorielles monochromes, rendues à
 * l'identique sur tous les OS (les emojis varient d'Android à iOS et
 * cassaient le registre « pro »). Emoji inconnu → affiché tel quel.
 */
export const EMOJI_ICONS: Record<string, LucideIcon> = {
  "🌐": Globe,
  "🛡️": Shield,
  "🤖": Bot,
  "🚀": Rocket,
  "💼": Briefcase,
  "🧳": Luggage,
  "📈": TrendingUp,
  "🧩": Puzzle,
  "🎯": Target,
  "✦": Sparkles,
  "🌱": Sprout,
  "⚙️": Cog,
  "🧭": Compass,
  "🏆": Trophy,
  "🤝": Handshake,
  "🧑‍🏫": GraduationCap,
  "🚧": Hammer,
  "⚔️": Swords,
  "🔍": Search,
  "🔎": Search,
  "📜": ScrollText,
  "🎨": Palette,
  "🔧": Wrench,
  "🏛️": Landmark,
  "🧠": Brain,
  "🛠️": Wrench,
  "🎓": GraduationCap,
  "🔄": RefreshCw,
  "🌤️": CloudSun,
  "💡": Lightbulb,
};

/** Icône vectorielle d'un emoji connu ; sinon l'emoji lui-même. */
export function EmojiIcon({ emoji, className }: { emoji: string; className?: string }) {
  const Icon = EMOJI_ICONS[emoji];
  if (Icon) return <Icon className={className} aria-hidden />;
  return (
    <span className="text-lg leading-none" aria-hidden>
      {emoji}
    </span>
  );
}
