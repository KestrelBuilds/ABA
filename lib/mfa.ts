export class MfaRequiredError extends Error {
  constructor() {
    super("Enter your authenticator code to continue.");
    this.name = "MfaRequiredError";
  }
}
export function requiresMfa(
  role: string,
  factors: { status: string }[] | undefined,
  level: string | null,
) {
  return (
    role === "admin" &&
    Boolean(factors?.some((f) => f.status === "verified")) &&
    level !== "aal2"
  );
}

export function authenticatorQrSource(qr: string): string {
  if (qr.startsWith("data:image/svg+xml;base64,")) return qr;
  const svg = qr.startsWith("data:image/svg+xml;utf-8,")
    ? qr.slice(qr.indexOf(",") + 1)
    : qr;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
