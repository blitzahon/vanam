import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { DashboardClient } from "@/components/dashboard-client";
import { getClerkConfigurationIssue, isClerkEnabled } from "@/lib/clerk";
import { getDashboardPayload } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "VANAM — National Highway Surveillance",
  description: "Secure command dashboard for real-time road safety monitoring, wildlife detection, and incident response."
};

export default async function DashboardPage() {
  const clerkEnabled = isClerkEnabled();
  const clerkConfigurationIssue = getClerkConfigurationIssue();

  if (clerkConfigurationIssue) {
    return (
      <main className="dashboard-page">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">National Highway Surveillance Command</p>
            <h1>Employee authentication needs to be fixed before this dashboard can go live.</h1>
          </div>
          <div className="header-actions">
            <Link href="/">Back to sign-in</Link>
          </div>
        </header>

        <section className="setup-card">
          <strong>Authentication needs production Clerk keys.</strong>
          <p>{clerkConfigurationIssue}</p>
          <div className="auth-env-list">
            <code>NEXT_PUBLIC_AUTHENTICATION_CLERK_PUBLISHABLE_KEY</code>
            <code>AUTHENTICATION_CLERK_SECRET_KEY</code>
          </div>
        </section>
      </main>
    );
  }

  const payload = await getDashboardPayload();

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">National Highway Surveillance Command</p>
          <h1>Intelligent Road Safety Surveillance — Real-Time Threat Detection & Incident Response.</h1>
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
