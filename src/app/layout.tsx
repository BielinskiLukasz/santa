import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sekretny Mikołaj · Generator losowania prezentów",
  description:
    "Bezpieczne, bezpłatne losowanie prezentów: czysty silnik z liczeniem dopełnień, szyfrowanie WebCrypto, blokada losowania i animacja odsłaniania wyniku.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#124433",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
