import { UserButton } from "@clerk/nextjs";
import { auth as getAuth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard-client";
import { getDashboardPayload } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "VANAM Dashboard",
  description: "Road safety operations dashboard for the VANAM platform."
};

export default async function DashboardPage() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
  let userId = null;

  if (clerkEnabled) {
    const authState = await getAuth();
    userId = authState.userId;
    if (!userId) {
      redirect("/");
    }
  }

  const payload = await getDashboardPayload();

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Command center</p>
          <h1>Operational visibility across alerts, assets, and incident evidence.</h1>
        </div>
        <div className="header-actions">
          <Link href="/api/overview">Data feed</Link>
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
