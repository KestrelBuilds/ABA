import BrandMark from "@/components/brand-mark";
import Link from "next/link";
export default function Setup() {
  return (
    <main className="auth-page">
      <Link className="logo" href="/" aria-label="Alex Bell Arts home">
        <BrandMark />
      </Link>
      <section className="panel auth-panel">
        <div className="eyebrow">ABA STUDIO / CONNECTION SETUP</div>
        <h1>A home for your projects.</h1>
        <p>
          The secure workspace needs a Supabase development project. The
          fictional demo remains available while this is connected.
        </p>
        <ol>
          <li>
            Create a Supabase project in the UK region if available. Keep real
            client data out for now.
          </li>
          <li>
            Run both SQL migration files in <code>supabase/migrations</code>, in
            filename order.
          </li>
          <li>
            Add the project URL and publishable key to hosting environment
            settings. See <code>.env.example</code>.
          </li>
          <li>
            Create your owner account in Supabase Authentication and assign its
            admin role using the instructions in{" "}
            <code>docs/PHASE2-SETUP.md</code>.
          </li>
          <li>
            Configure the site URL, allowed sign-in redirect and email delivery.
            Add the server-only service key for invitations.
          </li>
          <li>
            Run the hosted two-client isolation checklist before using real
            information.
          </li>
        </ol>
        <p>No connection settings or secret values should be posted in chat.</p>
        <Link className="primary" href="/demo">
          Open fictional demo
        </Link>{" "}
        <Link className="secondary" href="/login">
          Sign in
        </Link>
      </section>
    </main>
  );
}
