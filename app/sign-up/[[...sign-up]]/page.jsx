import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

  return (
    <main className="login-page">
      <section className="login-shell auth-shell-centered">
        <div className="login-panel auth-panel-centered">
          <div className="login-brand">
            <div className="brand-mark">
              <span className="brand-dot" />
              VANAM
            </div>
            <span className="login-badge">Operator onboarding</span>
          </div>

          <div className="login-copy">
            <p className="eyebrow">Create account</p>
            <h1>Join the command center.</h1>
            <p className="login-text">Create an operator account to access the monitoring workspace.</p>
          </div>

          {clerkEnabled ? (
            <div className="auth-card">
              <SignUp
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
                    formResendCodeLink: "clerk-link"
                  }
                }}
                routing="path"
                signInUrl="/"
              />
            </div>
          ) : (
            <div className="auth-card auth-card-empty">
              <strong>Authentication setup required</strong>
              <p>Add Clerk keys before enabling operator account creation.</p>
              <div className="auth-actions">
                <Link className="primary-link" href="/">
                  Back to sign in
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
