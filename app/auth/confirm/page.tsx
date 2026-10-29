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
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash, type } = await searchParams;
  const recovery = type === "recovery";
  return (
    <main className="auth-page">
      <section className="panel auth-panel">
        <div className="eyebrow">
          {recovery
            ? "ABA STUDIO / YOUR PASSWORD"
            : "ABA STUDIO / AN INVITATION"}
        </div>
        <h1>
          {recovery ? "Let’s get you signed in." : "Your project starts here."}
        </h1>
        <p>
          {recovery
            ? "Continue with your private reset link, then choose a new password."
            : "I’ve made a space just for your project. Accept your private invitation, then set a password for future visits."}
        </p>
        {token_hash &&
        token_hash.length >= 20 &&
        token_hash.length <= 2048 &&
        (!type || type === "invite" || recovery) ? (
          <AcceptInvitation
            token={token_hash}
            kind={recovery ? "recovery" : "invite"}
          />
        ) : (
          <p>
            This invitation is incomplete. Please ask Alex for a fresh link.
          </p>
        )}
      </section>
    </main>
  );
}
