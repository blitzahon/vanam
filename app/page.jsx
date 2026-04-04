import Link from "next/link";

export default function HomePage() {
  return (
    <main className="marketing-page">
      <section className="hero-shell">
        <nav className="top-nav">
          <div className="brand-mark">
            <span className="brand-dot" />
            VANAM
          </div>
          <div className="nav-actions">
            <Link href="/dashboard">Open dashboard</Link>
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Vercel product layer</p>
            <h1>Turn VANAM into a deployable safety product with a web dashboard and hosted incident database.</h1>
            <p className="hero-text">
              This frontend is designed for Vercel deployment with a Neon Postgres backend. It gives you a clean operator
              dashboard, a ready ingest API, and a foundation for auth, notifications, and customer-facing reporting.
            </p>
            <div className="hero-actions">
              <Link className="primary-link" href="/dashboard">
                Launch dashboard
              </Link>
              <a className="secondary-link" href="#stack">
                View architecture
              </a>
            </div>
          </div>

          <div className="hero-panel">
            <div className="hero-stat">
              <span>Frontend</span>
              <strong>Next.js App Router</strong>
            </div>
            <div className="hero-stat">
              <span>Database</span>
              <strong>Neon Postgres</strong>
            </div>
            <div className="hero-stat">
              <span>Deployment</span>
              <strong>Vercel-ready</strong>
            </div>
            <div className="hero-stat">
              <span>Ingest</span>
              <strong>POST /api/events</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="feature-strip" id="stack">
        <article className="feature-card">
          <h2>Product UI</h2>
          <p>A polished dashboard experience for operators, demos, and future customers.</p>
        </article>
        <article className="feature-card">
          <h2>Hosted SQL</h2>
          <p>Neon Postgres gives you a scalable, Vercel-friendly source of truth for incidents.</p>
        </article>
        <article className="feature-card">
          <h2>Bridge-ready</h2>
          <p>Your Python detector can send events to the web product through a simple API contract.</p>
        </article>
      </section>
    </main>
  );
}
