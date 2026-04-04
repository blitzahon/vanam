import { UserButton } from "@clerk/nextjs";
import { auth as getAuth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard-client";
import { getClerkSignInUrl, isClerkEnabled } from "@/lib/clerk";
import { getDashboardPayload } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "VANAM Dashboard",
  description: "Secure operations dashboard for the VANAM monitoring workspace."
};

export default async function DashboardPage() {
  const clerkEnabled = isClerkEnabled();
  const signInUrl = getClerkSignInUrl();

  if (clerkEnabled) {
    const authState = await getAuth();
    if (!authState.userId) {
      redirect(signInUrl);
    }
  }

  const payload = await getDashboardPayload();

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Operations Workspace</p>
          <h1>Live monitoring, verified alerts, and response evidence in one secure view.</h1>
        </div>
        <div className="header-actions">
          {clerkEnabled ? (
            <div className="user-button-shell">
              <UserButton afterSignOutUrl="/" />
            </div>
          ) : (
            <Link href="/">Sign in</Link>
          )}
        </div>
      </header>

      <DashboardClient initialPayload={payload} />
    </main>
  );
}
