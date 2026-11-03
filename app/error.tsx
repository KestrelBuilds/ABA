"use client";
import BrandMark from "@/components/brand-mark";
import Link from "next/link";
import ContactAlex from "@/components/contact-alex";
import BrandSignature from "@/components/brand-signature";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <Link className="logo" href="/" aria-label="Alex Bell Arts home">
        <BrandMark />
      </Link>
      <section className="panel auth-panel">
        <h1>A moment to regroup.</h1>
        <p>
          Your workspace could not be loaded. Please try again. If it continues,
          contact me and describe what you were trying to do. Please don’t send
          passwords, sign-in links or authentication codes.
        </p>
        <button className="primary" onClick={reset}>
          Try again
        </button>
        <a className="resource" href="/login">
          Return to sign-in
        </a>
        <ContactAlex />
      </section>
      <BrandSignature />
    </main>
  );
}
