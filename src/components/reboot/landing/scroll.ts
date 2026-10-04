/**
 * Défilement vers une ancre de la landing (respecte reduced-motion).
 *
 * Le scroll seul ne déplace pas le focus : un utilisateur au clavier ou un
 * lecteur d'écran resterait sur le bouton d'origine, sans que la nouvelle
 * section soit annoncée. On déplace donc le focus sur la cible, en la rendant
 * temporairement focusable (`tabindex="-1"`, retiré à la sortie du focus).
 *
 * `preventScroll: true` est indispensable : sans lui, l'appel à `focus()`
 * annulerait l'animation de défilement.
 */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });

  if (!el.hasAttribute("tabindex")) {
    el.setAttribute("tabindex", "-1");
    el.addEventListener(
      "blur",
      () => {
        el.removeAttribute("tabindex");
      },
      { once: true },
    );
  }
  el.focus({ preventScroll: true });
}