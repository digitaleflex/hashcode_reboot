import "./globals.css";

/**
 * Layout racine minimal — volontairement sans `<html>` ni `<body>`.
 *
 * Toutes les pages vivent sous `app/[locale]/`, et c'est ce layout-là qui
 * porte `<html lang={locale}>`. C'est la seule façon d'obtenir un attribut
 * `lang` correct : un layout racine ne connaît pas le segment `[locale]`, il
 * annonçait donc `lang="fr"` même sur `/en` (mauvaise indexation des pages
 * anglaises, mauvaise synthèse vocale).
 *
 * Ce fichier ne sert plus qu'à charger la feuille de styles globale et à
 * satisfaire la convention de l'App Router. `metadata`, `viewport` et le
 * `<body>` ont migré dans `app/[locale]/layout.tsx`.
 *
 * Limite connue : sur les réponses 404, Next sert son document d'erreur
 * (`<html id="__next_error__">`) construit sans le layout racine, donc sans
 * attribut `lang` dans le HTML initial. L'attribut est restauré dès
 * l'hydratation (React applique `<html lang={locale}>` au document existant) :
 * `document.documentElement.lang` est donc correct pour l'utilisateur et pour
 * les lecteurs d'écran. Ces pages sont par ailleurs en `noindex` et le HTML
 * initial ne contient déjà pas le contenu de la 404. Les pages de contenu, elles,
 * sont bien servies avec le bon `lang` (vérifié sur `/`, `/en`, `/login`, etc.).
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
