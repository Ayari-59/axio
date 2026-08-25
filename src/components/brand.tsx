/**
 * Marque Axio.
 *
 * Le logo est un composant plutôt qu'un fichier : il suit la taille du texte, hérite de la
 * couleur du fond de marque, et n'ajoute aucune requête réseau à des pages déjà rendues côté
 * serveur. Le même dessin est servi comme favicon par `src/app/icon.svg` — modifier l'un sans
 * l'autre ferait diverger l'onglet et l'écran.
 */

export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Axio"
    >
      <rect width="32" height="32" rx="7.5" fill="currentColor" />
      <g
        stroke="#ffffff"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M9.2 23.2 L16 8.8 L22.8 23.2" />
        <path d="M11.6 19.6 L20.4 19.6" />
      </g>
    </svg>
  );
}

/** Logo + nom : le verrou de marque utilisé dans les en-têtes. */
export function Wordmark({ size = 32 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <Logo size={size} className="text-brand-600 shrink-0" />
      <span className="font-semibold tracking-tight">Axio</span>
    </span>
  );
}
