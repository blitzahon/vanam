import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { auth as getAuth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

  if (clerkEnabled) {
    const { userId } = await getAuth();

    if (userId) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="access-page">
      <section className="access-shell">
        <section className="access-hero">
          <div className="access-hero-backdrop" />

          <header className="access-topbar">
            <div className="brand-mark">
              <span className="brand-dot" />
              VANAM
            </div>
            <span className="access-status">Operator Network</span>
          </header>

          <div className="access-copy">
            <p className="eyebrow">Protected Operations</p>
            <h1>Roadside intelligence for teams that need to react fast.</h1>
            <p className="access-text">
              Monitor live camera coverage, review verified animal and accident events, and move from detection to response in one secure workspace.
            </p>
          </div>

          <div className="access-preview">
            <div className="preview-command">
              <div className="preview-command-head">
                <span className="preview-kicker">Live command feed</span>
                <span className="preview-chip">Priority channel</span>
              </div>

              <div className="preview-timeline">
                <div className="preview-event">
                  <span className="preview-dot live" />
                  <div>
                    <strong>Animal crossing risk flagged</strong>
                    <p>Crossing zone persistence reached threshold on camera 02. Snapshot stored and alert chain armed.</p>
                  </div>
                </div>

                <div className="preview-event">
                  <span className="preview-dot warn" />
                  <div>
                    <strong>Vehicle dwell anomaly under review</strong>
                    <p>Stationary vehicle timer crossed advisory window. Secondary signal watch remains active.</p>
                  </div>
                </div>

                <div className="preview-event">
                  <span className="preview-dot" />
                  <div>
                    <strong>Operator dashboard synchronized</strong>
                    <p>Event history, alert status, and field evidence remain available in the secured control surface.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="access-stat-grid">
              <div className="access-stat-card">
                <span>Detection stack</span>
                <strong>YOLOv8 pipeline</strong>
              </div>
              <div className="access-stat-card">
                <span>Alert flow</span>
                <strong>SMS, email, webhook</strong>
              </div>
              <div className="access-stat-card">
                <span>Evidence retention</span>
                <strong>Snapshots + event log</strong>
              </div>
            </div>
          </div>
        </section>

        <aside className="access-auth-panel">
          <div className="access-auth-shell">
            <div className="access-auth-header">
              <span className="access-auth-kicker">Secure login</span>
              <h2>Sign in to VANAM</h2>
              <p>Use your operator credentials to access the live command dashboard and response workflows.</p>
            </div>

            {clerkEnabled ? (
              <div className="auth-card auth-card-light">
                <SignIn
                  appearance={{
                    elements: {
                      rootBox: "clerk-root",
                      card: "clerk-card",
                      headerTitle: "clerk-title",
                      headerSubtitle: "clerk-subtitle",
                      socialButtonsBlockButton: "clerk-social-button",
                      formButtonPrimary: "clerk-primary-button",
                      footerActionLink: "clerk-link",
                      formFieldInput: "clerk-input",
                      formFieldLabel: "clerk-label",
                      identityPreviewText: "clerk-subtitle",
                      identityPreviewEditButton: "clerk-link",
                      formResendCodeLink: "clerk-link",
                      dividerLine: "clerk-divider-line",
                      dividerText: "clerk-divider-text",
                      formFieldSuccessText: "clerk-success-text",
                      alertText: "clerk-alert-text"
                    }
                  }}
                  routing="path"
                  signUpUrl="/sign-up"
                />
              </div>
            ) : (
              <div className="auth-card auth-card-empty auth-card-light">
                <strong>Authentication setup required</strong>
                <p>Add your Clerk publishable key and secret key to enable protected operator sign-in.</p>
                <div className="auth-env-list">
                  <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
                  <code>CLERK_SECRET_KEY</code>
                </div>
                <div className="auth-actions">
                  <Link className="primary-link" href="/dashboard">
                    Open dashboard
                  </Link>
                  <Link className="secondary-link" href="/sign-up">
                    Open sign-up
                  </Link>
                </div>
              </div>
            )}

            <div className="access-auth-footer">
              <span>Deployment-ready access control for your operations team.</span>
              <Link href="/dashboard">Preview dashboard</Link>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
