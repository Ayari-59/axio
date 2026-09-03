import type { Metadata, Viewport } from "next";
import { Fraunces, Sora } from "next/font/google";
import "./globals.css";

// Fraunces porte les titres (h1) ; Sora, tout le reste. next/font héberge les
// fichiers au build : pas de requête vers Google au chargement, pas de saut de
// mise en page. Les variables sont lues par globals.css (--font-display, --font-sans).
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Axio — l'OS du contrôle de gestion",
    // Les pages internes ajoutent leur propre titre : l'onglet reste identifiable
    // même quand le favicon est masqué par un onglet actif voisin.
    template: "%s · Axio",
  },
  description:
    "Plateforme intelligente qui transforme les données de l'entreprise en système de pilotage personnalisé.",
  applicationName: "Axio",
};

// `icon.svg` et `apple-icon.png` sont détectés par convention dans `src/app/` :
// les déclarer ici en plus produirait des balises en double.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#060e22" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sora.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
