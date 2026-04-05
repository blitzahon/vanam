import "@/lib/clerk-env";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import "@/app/globals.css";
import { getClerkPublishableKey, getClerkSignInUrl, getClerkSignUpUrl, isClerkEnabled } from "@/lib/clerk";

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
  title: "VANAM",
  description: "Operational command center for roadside monitoring and incident response."
};

export default function RootLayout({ children }) {
  const clerkEnabled = isClerkEnabled();
  const publishableKey = getClerkPublishableKey();
  const signInUrl = getClerkSignInUrl();
  const signUpUrl = getClerkSignUpUrl();

  return (
    <html className={`${display.variable} ${mono.variable}`} lang="en">
      <body>
        {clerkEnabled ? (
          <ClerkProvider
            publishableKey={publishableKey}
            signInFallbackRedirectUrl="/dashboard"
            signInUrl={signInUrl}
            signUpUrl={signUpUrl}
          >
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
        <Analytics />
      </body>
    </html>
  );
}
