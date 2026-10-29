import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
// Caller must validate the owner/MFA identity before passing these clients.
export async function createClientInvitation(
  db: SupabaseClient,
  service: () => SupabaseClient,
  clientId: string,
  origin: string,
) {
  const capability = await db.rpc("client_invitations_ready");
  if (capability.error || capability.data !== true)
    throw Error(
      "Apply the client invitations SQL update before creating invitations.",
    );
  const client = await db
    .from("clients")
    .select("id,email")
    .eq("id", clientId)
    .single();
  if (client.error || !client.data) throw Error("Client could not be found.");
  const account = await db.rpc("client_invitation_account", {
    target: clientId,
  });
  if (account.error) throw Error(account.error.message);
  let userId: string, token: string | undefined;
  if (account.data) {
    userId = z.uuid().parse(account.data);
  } else {
    const generated = await service().auth.admin.generateLink({
      type: "invite",
      email: client.data.email,
    });
    if (generated.error || !generated.data.user)
      throw Error(
        "The invitation could not be created. Try again; if this email was just registered, its existing account will be used.",
      );
    if (generated.data.user.email_confirmed_at)
      throw Error(
        "This email already has an account. Create a fresh invitation to use its existing sign-in.",
      );
    if (
      generated.data.user.email?.trim().toLowerCase() !==
      client.data.email.trim().toLowerCase()
    )
      throw Error(
        "The invitation account did not match this client. No access was granted.",
      );
    userId = z.uuid().parse(generated.data.user.id);
    token = z
      .string()
      .min(20)
      .max(2048)
      .parse(generated.data.properties.hashed_token);
  }
  const saved = await db.rpc("record_client_invitation", {
    target: clientId,
    account: userId,
  });
  // Never delete or reset an Auth account on a persistence failure, including a provider race.
  if (saved.error)
    throw Error(
      saved.error.message ||
        "The invitation could not be saved. No portal access was granted.",
    );
  return token
    ? {
        ok: true,
        message:
          "Invitation ready. Copy the private link and send it to this client yourself. It signs them in once; they can then set a password. If the link expires, create a fresh invitation here.",
        link: origin + "/auth/confirm?token_hash=" + encodeURIComponent(token),
      }
    : {
        ok: true,
        message:
          "A fresh invitation is ready for their existing account. Copy the sign-in link and send it to the client. They must sign in using the email saved on this client record, with their password or an emailed sign-in link. No password was changed and no email was sent.",
        link: origin + "/login?invited=1",
      };
}
