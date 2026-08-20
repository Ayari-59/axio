import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Axio — l'OS du contrôle de gestion",
  description:
    "Plateforme intelligente qui transforme les données de l'entreprise en système de pilotage personnalisé.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
