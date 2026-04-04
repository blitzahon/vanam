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
            <p className="eyebrow">Secure Operations</p>
            <h1>Give every operator one place to see alerts, confirm incidents, and respond fast.</h1>
            <p className="access-text">
              VANAM keeps live camera activity, verified roadside events, and response evidence in a single protected workspace for your field and control room teams.
            </p>
          </div>

          <div className="access-preview">
            <div className="preview-command">
              <div className="preview-command-head">
                <span className="preview-kicker">Active operations</span>
                <span className="preview-chip">Employee workspace</span>
              </div>

              <div className="preview-timeline">
                <div className="preview-event">
                  <span className="preview-dot live" />
                  <div>
                    <strong>Wildlife alert escalated</strong>
                    <p>Camera 02 flagged repeated roadside movement and the latest evidence is ready for supervisor review.</p>
                  </div>
                </div>

                <div className="preview-event">
                  <span className="preview-dot warn" />
                  <div>
                    <strong>Collision response in progress</strong>
                    <p>The field team has acknowledged the newest incident and the event timeline is prepared for handoff.</p>
                  </div>
                </div>

                <div className="preview-event">
                  <span className="preview-dot" />
                  <div>
                    <strong>Shift handover synchronized</strong>
                    <p>The next operator sees open alerts, latest evidence, and camera status the moment they sign in.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="access-stat-grid">
              <div className="access-stat-card">
                <span>Monitored coverage</span>
                <strong>Roadside cameras in one view</strong>
              </div>
              <div className="access-stat-card">
                <span>Team workflow</span>
                <strong>Review, confirm, respond</strong>
              </div>
              <div className="access-stat-card">
                <span>Evidence access</span>
                <strong>Snapshots, timelines, notes</strong>
              </div>
            </div>
          </div>
        </section>

        <aside className="access-auth-panel">
          <div className="access-auth-shell">
            <div className="access-auth-header">
              <span className="access-auth-kicker">Employee Access</span>
              <h2>Sign in to the VANAM workspace</h2>
              <p>Use your assigned employee credentials to open the live monitoring dashboard and incident response tools.</p>
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
                      formFieldInput: "clerk-input",
                      formFieldLabel: "clerk-label",
                      identityPreviewText: "clerk-subtitle",
                      identityPreviewEditButton: "clerk-link",
                      formResendCodeLink: "clerk-link",
                      dividerLine: "clerk-divider-line",
                      dividerText: "clerk-divider-text",
                      formFieldSuccessText: "clerk-success-text",
                      alertText: "clerk-alert-text",
                      footerAction: "clerk-footer-hidden",
                      footerActionText: "clerk-footer-hidden",
                      footerActionLink: "clerk-footer-hidden"
                    }
                  }}
                  fallbackRedirectUrl="/dashboard"
                  routing="path"
                  signInUrl="/"
                  withSignUp={false}
                />
              </div>
            ) : (
              <div className="auth-card auth-card-empty auth-card-light">
                <strong>Employee sign-in is not enabled in this environment.</strong>
                <p>Add your Clerk publishable key and secret key here to enable protected access for the operations team.</p>
                <div className="auth-env-list">
                  <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
                  <code>CLERK_SECRET_KEY</code>
                </div>
              </div>
            )}

            <div className="access-auth-footer">
              <span>Protected access for the operations team.</span>
              {clerkEnabled ? <Link href="/dashboard">Open secure workspace</Link> : null}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
