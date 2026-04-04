import Link from "next/link";

import { DashboardClient } from "@/components/dashboard-client";
import { getDashboardPayload } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "VANAM Dashboard",
  description: "Road safety operations dashboard for the VANAM platform."
};

export default async function DashboardPage() {
  const payload = await getDashboardPayload();

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Operations dashboard</p>
          <h1>Road safety intelligence, shaped for a Vercel product.</h1>
        </div>
        <div className="header-actions">
          <Link href="/">Back to product</Link>
          <a href="https://vercel.com/docs/functions/quickstart" rel="noreferrer" target="_blank">
            Vercel docs
          </a>
        </div>
      </header>

      <DashboardClient initialPayload={payload} />
    </main>
  );
}
