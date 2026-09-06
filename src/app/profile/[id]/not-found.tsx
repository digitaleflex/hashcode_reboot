import Link from "next/link";

export default function ProfileNotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <header className="absolute top-0 left-0 right-0 border-b border-border/60 py-4">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between">
          <span className="mono-label text-lime text-sm font-bold tracking-widest">
            HASHCODE REBOOT
          </span>
        </div>
      </header>

      <main className="text-center px-4">
        <div className="text-8xl font-display font-bold italic text-lime mb-4">404</div>
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">
          Profil introuvable
        </h1>
        <p className="text-muted-foreground mb-8">
          Ce profil n'existe pas ou a été supprimé.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-lime text-black font-medium hover:bg-lime/90 transition-colors"
        >
          ← Retour au site
        </Link>
      </main>
    </div>
  );
}
