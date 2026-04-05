import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

import { getClerkConfigurationIssue, getClerkSignInUrl, isClerkEnabled } from "@/lib/clerk";

export default function HomePage() {
  const clerkEnabled = isClerkEnabled();
  const signInUrl = getClerkSignInUrl();
  const clerkConfigurationIssue = getClerkConfigurationIssue();
  const canRenderSignIn = clerkEnabled && !clerkConfigurationIssue;

  return (
    <main className="access-page access-page-auth-only">
      <section className="access-shell auth-shell-centered">
        <aside className="access-auth-panel auth-panel-centered">
          <div className="access-auth-shell">
            <div className="access-auth-header">
              <div className="brand-mark auth-brand-mark">
                <span className="brand-dot" />
                VANAM
              </div>
              <span className="access-auth-kicker">Employee Access</span>
              <h2>Sign in to the VANAM workspace</h2>
              <p>Use your assigned employee credentials to open the live monitoring dashboard and incident response tools.</p>
            </div>

            {clerkConfigurationIssue ? (
              <div className="auth-card auth-card-empty auth-card-light">
                <strong>Authentication needs production Clerk keys.</strong>
                <p>{clerkConfigurationIssue}</p>
                <div className="auth-env-list">
                  <code>NEXT_PUBLIC_AUTHENTICATION_CLERK_PUBLISHABLE_KEY</code>
                  <code>AUTHENTICATION_CLERK_SECRET_KEY</code>
                </div>
              </div>
            ) : canRenderSignIn ? (
              <div className="auth-card auth-card-light">
                <SignIn
                  fallbackRedirectUrl="/dashboard"
                  routing="path"
                  signInUrl={signInUrl}
                  withSignUp={false}
                />
              </div>
            ) : (
              <div className="auth-card auth-card-empty auth-card-light">
                <strong>Employee sign-in is not enabled in this environment.</strong>
                <p>Add your Clerk publishable key and secret key here to enable protected access for the operations team.</p>
                <div className="auth-env-list">
                  <code>NEXT_PUBLIC_AUTHENTICATION_CLERK_PUBLISHABLE_KEY</code>
                  <code>AUTHENTICATION_CLERK_SECRET_KEY</code>
                </div>
              </div>
            )}

            <div className="access-auth-footer">
              <span>Protected access for the operations team.</span>
              {canRenderSignIn ? <Link href="/dashboard" prefetch={false}>Open secure workspace</Link> : null}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}