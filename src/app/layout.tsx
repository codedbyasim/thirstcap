import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif" });
const sans = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "ThirstCap — cap the peak day",
    template: "%s · ThirstCap",
  },
  description:
    "ThirstCap plans data-center jobs, cooling mode, and a water tank over 72 hours so the peak day stays under a cap a utility can build around.",
  applicationName: "ThirstCap",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <Nav />
        <main id="content">{children}</main>
      </body>
    </html>
  );
}
