import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Internal diagnostic scope: all IDs are allocated by checkClientPortals.
// No caller-supplied client/account IDs or service-role operations are used.
type Scope = { clientId: string; projectId: string; userId: string };

function checked(error: unknown, step: string) {
  if (error) throw Error(step + " could not be completed.");
}
function verify(condition: boolean, step: string) {
  if (!condition) throw Error(step + " did not pass.");
}

export async function invitationChecksReady(owner: SupabaseClient) {
  const result = await owner.rpc("client_invitations_ready");
  if (
    result.status === 404 &&
    result.error &&
    ["PGRST202", "42883"].includes(result.error.code)
  )
    return false;
  checked(result.error || result.status !== 200, "Invitation capability check");
  verify(typeof result.data === "boolean", "Invitation capability response");
  return result.data === true;
}

async function assertInvitationDenied(session: SupabaseClient, step: string) {
  const result = await session.rpc("accept_invitation");
  // An outage, unrelated SQL error, or successful no-op is not an expiry or
  // revocation denial. Require the expected application rejection explicitly.
  verify(
    result.status >= 400 &&
      result.status < 500 &&
      result.error?.code === "P0001" &&
      result.error.message === "Ask Alex for a fresh invitation",
    step,
  );
}

async function assertNoAccess(session: SupabaseClient, scope: Scope) {
  const profile = await session
    .from("profiles")
    .select("id")
    .eq("id", scope.userId);
  checked(profile.error, "Unaccepted invitation account check");
  verify(
    profile.data?.length === 0,
    "Unaccepted invitation cannot create client membership",
  );
  const project = await session
    .from("projects")
    .select("id")
    .eq("id", scope.projectId);
  checked(project.error, "Unaccepted invitation project check");
  verify(
    project.data?.length === 0,
    "Unaccepted invitation project protection",
  );
}

async function renew(owner: SupabaseClient, scope: Scope) {
  checked(
    (
      await owner.rpc("record_client_invitation", {
        target: scope.clientId,
        account: scope.userId,
      })
    ).error,
    "Temporary invitation renewal",
  );
}

export async function checkExpiredInvitation(
  owner: SupabaseClient,
  session: SupabaseClient,
  scope: Scope,
) {
  await assertInvitationDenied(session, "Expired invitation rejection");
  await assertNoAccess(session, scope);
  await renew(owner, scope);
}

export async function checkReturningAccount(
  session: SupabaseClient,
  scope: Scope,
) {
  checked(
    (await session.rpc("accept_invitation")).error,
    "Returning-account invitation acceptance",
  );
  const profile = await session
    .from("profiles")
    .select("id,role,client_id")
    .eq("id", scope.userId)
    .single();
  checked(profile.error, "Returning-account membership check");
  verify(
    profile.data?.id === scope.userId &&
      profile.data.role === "client" &&
      profile.data.client_id === scope.clientId,
    "Returning-account identity preservation",
  );
}

export async function checkRevokedReinvitation(
  owner: SupabaseClient,
  session: SupabaseClient,
  other: SupabaseClient,
  scope: Scope & { otherProjectId: string },
) {
  await assertInvitationDenied(session, "Revoked invitation rejection");
  await assertNoAccess(session, scope);
  const before = await owner
    .from("projects")
    .select("contract_signed,deposit_paid,final_approved,final_paid")
    .eq("id", scope.projectId)
    .single();
  checked(before.error, "Reinvitation verification snapshot");
  await renew(owner, scope);
  await checkReturningAccount(session, scope);
  const visible = await session
    .from("projects")
    .select("id")
    .eq("id", scope.projectId);
  checked(visible.error, "Reinvited project read");
  verify(
    visible.data?.length === 1 && visible.data[0].id === scope.projectId,
    "Reinvited client project access",
  );
  for (const [reader, project] of [
    [session, scope.otherProjectId],
    [other, scope.projectId],
  ] as const) {
    const result = await reader.from("projects").select("id").eq("id", project);
    checked(result.error, "Reinvitation isolation check");
    verify(
      result.data?.length === 0,
      "Reinvitation preserves client isolation",
    );
  }
  const after = await owner
    .from("projects")
    .select("contract_signed,deposit_paid,final_approved,final_paid")
    .eq("id", scope.projectId)
    .single();
  checked(after.error, "Reinvitation verification check");
  verify(
    Boolean(before.data && after.data) &&
      (
        [
          "contract_signed",
          "deposit_paid",
          "final_approved",
          "final_paid",
        ] as const
      ).every((key) => before.data![key] === after.data![key]),
    "Reinvitation preserves payment and approval records",
  );
  checked(
    (await owner.rpc("revoke_client_access", { target: scope.clientId })).error,
    "Temporary renewed-access revocation",
  );
  await assertInvitationDenied(session, "Renewed invitation revocation");
  await assertNoAccess(session, scope);
}
