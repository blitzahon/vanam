import { Analytics } from "@vercel/analytics/next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import "@/app/globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono"
});

export const metadata = {
  title: "VANAM | Road Safety Intelligence",
  description: "A Vercel-ready road safety product for incident monitoring, evidence review, and event ingestion."
};

export default function RootLayout({ children }) {
  return (
    <html className={`${display.variable} ${mono.variable}`} lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
