import Link from "next/link";

export default function BrandSignature() {
  return (
    <footer className="brand-signature">
      <span>ABA STUDIO / ALEX BELL ARTS</span>
      <Link href="/privacy" className="privacy-link">
        Privacy & cookies
      </Link>
      <span>Loyalty is key.</span>
    </footer>
  );
}
