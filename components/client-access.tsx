"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, ExternalLink, UserRoundPlus } from "lucide-react";
import { inviteClient, revokeClientAccess, type Result } from "@/app/actions";
import { portalStatusLabels, type ClientPortalStatus } from "@/lib/invitations";
import type { DbClient } from "@/lib/workspace";
export default function ClientAccess({
  client,
  status,
  ready,
}: {
  client: DbClient;
  status?: ClientPortalStatus;
  ready: boolean;
}) {
  const [result, setResult] = useState<Result | null>(null),
    [pending, start] = useTransition(),
    [copied, setCopied] = useState(false);
  const router = useRouter();
  const connected = status?.state === "connected";
  const submit = (form: FormData, revoke = false) =>
    start(async () => {
      setResult(null);
      setCopied(false);
      try {
        const value = await (revoke ? revokeClientAccess : inviteClient)(form);
        setResult(value);
        if (value.ok) router.refresh();
      } catch {
        setResult({
          ok: false,
          message: "The request could not be completed. Please try again.",
        });
      }
    });
  return (
    <section
      className="client-access"
      id={"client-access-" + client.id}
      aria-label={"Client portal access for " + client.name}
    >
      <header>
        <h3>Client portal</h3>
        <span
          className={"status-badge " + (connected ? "status-verified" : "")}
        >
          {status
            ? portalStatusLabels[status.state]
            : ready
              ? "Status unavailable"
              : "Setup needed"}
        </span>
      </header>
      {ready && (
        <button
          type="button"
          className="text-button"
          onClick={() => router.refresh()}
        >
          Refresh access status
        </button>
      )}
      {!ready ? (
        <p>
          The client invitations database update is needed to use these
          controls. Your projects and files are unchanged.
        </p>
      ) : (
        <>
          <p>
            {connected
              ? "This client has connected their account. They can sign in again using the same email and password."
              : status?.state === "pending"
                ? "Their invitation is waiting to be accepted. Creating a fresh one replaces the pending invitation; their own sign-in confirms their identity."
                : status?.state === "revoked"
                  ? "Portal permission was removed. You can invite the same email again when a shared client area is ready."
                  : "Invite them using the email below. They’ll see only the project areas you have shared."}
          </p>
          <div className="invite-recipient">
            <span>Client sign-in email</span>
            <b>{client.email}</b>
          </div>
          {connected ? (
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setResult({
                  ok: true,
                  message:
                    "Send this sign-in link to the client. They should use the email above and their own password, or request an emailed sign-in link.",
                  link: new URL("/login", window.location.href).href,
                })
              }
            >
              Get portal sign-in link{" "}
              <ExternalLink size={16} aria-hidden="true" />
            </button>
          ) : (
            <>
              <ol className="invite-guide">
                <li>
                  Enable the project’s potential-client area, or verify contract
                  and deposit for full access.
                </li>
                <li>
                  Create an invitation, then copy and send its link directly to
                  the client.
                </li>
                <li>
                  They open the link and sign in. This status changes to Account
                  connected.
                </li>
              </ol>
              <form action={(form) => submit(form)}>
                <input type="hidden" name="clientId" value={client.id} />
                <button
                  className="primary"
                  disabled={pending || !status?.eligible}
                >
                  <UserRoundPlus size={17} aria-hidden="true" />
                  {pending
                    ? "Creating…"
                    : status?.state === "not_invited"
                      ? "Create portal invitation"
                      : "Create fresh invitation"}
                </button>
              </form>
              {!status?.eligible && (
                <p className="helper-note">
                  Set up a shared project area first. Open the client’s project
                  and enable its discovery view, or verify the contract and
                  deposit.
                </p>
              )}
              <p className="invitation-note">
                You send the link yourself. No invitation email is sent
                automatically.
              </p>
            </>
          )}
          {result && (
            <div
              className={result.ok ? "form-result" : "form-result error"}
              role={result.ok ? "status" : "alert"}
            >
              <p>{result.message}</p>
              {result.link && (
                <div className="invitation-link">
                  <label>
                    Link to send to this client
                    <input
                      value={result.link}
                      readOnly
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                  <button
                    type="button"
                    className="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(result.link!);
                        setCopied(true);
                      } catch {
                        setCopied(false);
                        setResult({
                          ...result,
                          message:
                            "Select and copy the link below, then send it to the client.",
                        });
                      }
                    }}
                  >
                    {copied ? (
                      <Check size={16} aria-hidden="true" />
                    ) : (
                      <Copy size={16} aria-hidden="true" />
                    )}
                    {copied
                      ? "Link copied"
                      : connected
                        ? "Copy sign-in link"
                        : "Copy invitation link"}
                  </button>
                  <small>
                    Keep invitation links private. Share them only with this
                    client.
                  </small>
                </div>
              )}
            </div>
          )}
          {["connected", "pending"].includes(status?.state ?? "") && (
            <details className="settings-disclosure">
              <summary>Remove portal access</summary>
              <p>
                This removes access for all accounts linked to this client.
                Their sign-in account and your project records remain. You can
                invite them again later.
              </p>
              <form action={(form) => submit(form, true)}>
                <input type="hidden" name="clientId" value={client.id} />
                <label className="check-row">
                  <input name="acknowledged" type="checkbox" required />I want
                  to remove this client’s portal access.
                </label>
                <button className="secondary" disabled={pending}>
                  Remove client access
                </button>
              </form>
            </details>
          )}
        </>
      )}
    </section>
  );
}
