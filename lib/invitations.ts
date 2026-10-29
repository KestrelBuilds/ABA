export type ClientPortalStatus = {
  client_id: string;
  eligible: boolean;
  state: "not_invited" | "pending" | "connected" | "expired" | "revoked";
  invited_at: string | null;
  accepted_at: string | null;
  expires_at: string | null;
};
export const portalStatusLabels: Record<ClientPortalStatus["state"], string> = {
  not_invited: "Not invited",
  pending: "Invitation pending",
  connected: "Account connected",
  expired: "Invitation expired",
  revoked: "Access revoked",
};
