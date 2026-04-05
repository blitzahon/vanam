import "@/lib/clerk-env";
import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { auth as getAuth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getClerkSignInUrl, isClerkEnabled } from "@/lib/clerk";

export default async function HomePage() {
  const clerkEnabled = isClerkEnabled();
  const signInUrl = getClerkSignInUrl();

  if (clerkEnabled) {
    const { userId } = await getAuth();

    if (userId) {
      redirect("/dashboard");
    }
  }

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
              {clerkEnabled ? <Link href="/dashboard" prefetch={false}>Open secure workspace</Link> : null}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
