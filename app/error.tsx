"use client";
import BrandMark from "@/components/brand-mark";
import Link from "next/link";
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
          check the Supabase connection and database setup.
        </p>
        <button className="primary" onClick={reset}>
          Try again
        </button>
        <a className="resource" href="/login">
          Return to sign-in
        </a>
      </section>
    </main>
  );
}
