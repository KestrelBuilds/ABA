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
          Your private project space with Alex Bell Arts. Sign in to view your
          shared files, give feedback and follow your next steps.
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
        <p className="muted">
          Access is by invitation. Sign in using the email address Alex invited.
        </p>
      </section>
      <BrandSignature />
    </main>
  );
}
