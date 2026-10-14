import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono } from "next/font/google";
import "@/styles/globals.scss";

// Self-hosted at build time by next/font, so visitors' browsers never call Google.
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "800"], variable: "--font-display" });
const body = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "bitrung; Climb the ladder, one bit at a time", template: "%s · bitrung;" },
  description: "Coding problems with five levels, instant verdicts and a ladder that fills up as you get better.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
