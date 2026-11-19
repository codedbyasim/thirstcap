import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { JetBrains_Mono, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "ThirstCap — Enterprise Data Center Water-Cap & ESG Control Plane",
    template: "%s | ThirstCap",
  },
  description:
    "72-hour rolling CBC MILP simulator for data-center peak-day water. Weather, grid, and workload inputs are cited datasets. EU EED A–G is a computed band, not a filed rating.",
  applicationName: "ThirstCap",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#04111D",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-marine-ink antialiased">
        <a className="skip-link" href="#content">
          Skip to main content
        </a>
        <Suspense fallback={<div className="h-[68px] border-b border-slate-800/80 bg-[#04111D]" />}>
          <Nav />
        </Suspense>
        <main id="content">{children}</main>
      </body>
    </html>
  );
}
