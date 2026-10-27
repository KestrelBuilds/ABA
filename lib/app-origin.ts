export function resolveAppOrigin(
  explicit?: string,
  productionHost?: string,
): string {
  const value =
    explicit?.trim() ||
    (productionHost?.trim() ? `https://${productionHost.trim()}` : "");
  if (!value)
    throw new Error(
      "Set APP_ORIGIN to your ABA Studio website address in Vercel settings.",
    );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("APP_ORIGIN must be a valid website address.");
  }
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    !(url.protocol === "https:" || (url.protocol === "http:" && local)) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "APP_ORIGIN must be your HTTPS website address without a page path or credentials.",
    );
  return url.origin;
}
