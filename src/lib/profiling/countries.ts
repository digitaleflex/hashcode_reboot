/** Curated country list (French names + flag emoji), Africa-weighted. */

export interface Country {
  code: string;
  name: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: "BJ", name: "Bénin", flag: "🇧🇯" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "SN", name: "Sénégal", flag: "🇸🇳" },
  { code: "TG", name: "Togo", flag: "🇹🇬" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "ML", name: "Mali", flag: "🇲🇱" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫" },
  { code: "NE", name: "Niger", flag: "🇳🇪" },
  { code: "CM", name: "Cameroun", flag: "🇨🇲" },
  { code: "CG", name: "Congo", flag: "🇨🇬" },
  { code: "CD", name: "RD Congo", flag: "🇨🇩" },
  { code: "GA", name: "Gabon", flag: "🇬🇦" },
  { code: "TD", name: "Tchad", flag: "🇹🇩" },
  { code: "MA", name: "Maroc", flag: "🇲🇦" },
  { code: "DZ", name: "Algérie", flag: "🇩🇿" },
  { code: "TN", name: "Tunisie", flag: "🇹🇳" },
  { code: "EG", name: "Égypte", flag: "🇪🇬" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "RW", name: "Rwanda", flag: "🇷🇼" },
  { code: "ZA", name: "Afrique du Sud", flag: "🇿🇦" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "BE", name: "Belgique", flag: "🇧🇪" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "US", name: "États-Unis", flag: "🇺🇸" },
  { code: "DE", name: "Allemagne", flag: "🇩🇪" },
  { code: "CH", name: "Suisse", flag: "🇨🇭" },
  { code: "GB", name: "Royaume-Uni", flag: "🇬🇧" },
  { code: "other", name: "Autre pays", flag: "🌍" },
];

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}
export function countryFlag(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.flag ?? "🌍";
}
