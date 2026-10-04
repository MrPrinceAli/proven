import type { Metadata } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { site } from "@/lib/site";
import { Providers } from "./providers";
import "./globals.css";

// Plus Jakarta Sans was designed in Indonesia (Tokotype); Instrument Serif gives the italic accent.
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute URLs for the Open Graph / Twitter card image (app/opengraph-image.png).
  metadataBase: new URL(process.env.APP_URL || "https://proven-id.vercel.app"),
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
