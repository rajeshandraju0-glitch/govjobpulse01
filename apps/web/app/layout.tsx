import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { OrganizationJsonLd } from "@/components/json-ld/OrganizationJsonLd";
import { WebSiteJsonLd } from "@/components/json-ld/WebSiteJsonLd";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

import { SITE_URL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "GovJobPulse — Sarkari Naukri, Verified",
    template: "%s | GovJobPulse",
  },
  description:
    "GovJobPulse tracks official government sources to bring you every Sarkari Naukri notification, admit card, result and answer key the moment it's released — verified, organised, and built for students who can't afford to miss a deadline.",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
  },
  alternates: {
    types: {
      "application/rss+xml": `${SITE_URL}/feed.xml`,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-body bg-white text-secondary">
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
