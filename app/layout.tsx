import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const inter = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], style: ["italic"], weight: ["400"], variable: "--font-source-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Supplier Resilience", template: "%s · Supplier Resilience" },
  description: "Supplier resilience prototype on synthetic Aerospace MRO data.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
