import { AcceptInvitation } from "@/components/auth-forms";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Your ABA Studio invitation",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default async function Confirm({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash } = await searchParams;
  return (
    <main className="auth-page">
      <section className="panel auth-panel">
        <div className="eyebrow">ABA STUDIO / AN INVITATION</div>
        <h1>Your project starts here.</h1>
        <p>
          I’ve made a space just for your project. Accept your private
          invitation to begin.
        </p>
        {token_hash && token_hash.length <= 2048 ? (
          <AcceptInvitation token={token_hash} />
        ) : (
          <p>
            This invitation is incomplete. Please ask Alex for a fresh link.
          </p>
        )}
      </section>
    </main>
  );
}
