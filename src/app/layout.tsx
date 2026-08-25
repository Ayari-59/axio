import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
