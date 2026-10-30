import BrandSignature from "@/components/brand-signature";
import BrandMark from "@/components/brand-mark";
import Link from "next/link";
export default function Home() {
  return (
    <main className="auth-page">
      <Link href="/" className="logo">
        <BrandMark />
      </Link>
      <section className="panel auth-panel">
        <div className="eyebrow">ALEX BELL ARTS</div>
        <h1>Your vision. My creative direction.</h1>
        <p>
          A personalised creative journey, built on research and clear
          communication. Explore the thinking behind the design, share your
          feedback and see what happens next.
        </p>
        <div className="brand-values" aria-label="Brand values">
          {[
            "Loyalty",
            "Inspiration",
            "Diversity",
            "Courage",
            "Communication",
            "Integrity",
          ].map((value) => (
            <span key={value}>{value}</span>
          ))}
        </div>
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
      <BrandSignature />
    </main>
  );
}
