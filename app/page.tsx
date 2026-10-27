import Link from "next/link";
export default function Home() {
  return (
    <main className="auth-page">
      <Link href="/" className="logo">
        aba<span>STUDIO</span>
      </Link>
      <section className="panel auth-panel">
        <div className="eyebrow">ALEX BELL ARTS</div>
        <h1>A considered space for good things.</h1>
        <p>
          Your creative project, from the first conversation to the final
          detail.
        </p>
        <Link className="primary full" href="/portal">
          Open my workspace →
        </Link>
        <Link className="resource" href="/demo">
          Explore the fictional demonstration →
        </Link>
        <p className="muted">
          Development version. Use fictional details until security and
          deployment checks are complete.
        </p>
      </section>
    </main>
  );
}
