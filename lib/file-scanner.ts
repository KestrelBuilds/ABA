export type ScannerConfig = { url: string; key: string; allowLocal?: boolean };
export function validScanner(config: ScannerConfig | undefined) {
  if (!config?.url || !config.key) return false;
  try {
    const url = new URL(config.url);
    return (
      !url.username &&
      !url.password &&
      !url.hash &&
      (url.protocol === "https:" ||
        (config.allowLocal === true &&
          url.protocol === "http:" &&
          ["127.0.0.1", "localhost"].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}
export async function scanFile(
  bytes: Buffer,
  name: string,
  mime: string,
  sha256: string,
  config: ScannerConfig,
  fetcher: typeof fetch = fetch,
): Promise<"clean" | "rejected"> {
  if (!validScanner(config))
    throw Error("The upload security scanner is not configured.");
  const response = await fetcher(config.url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + config.key,
      "Content-Type": "application/octet-stream",
      "X-File-Name": encodeURIComponent(name),
      "X-File-SHA256": sha256,
      "X-Upload-Content-Type": mime,
    },
    body: new Uint8Array(bytes).buffer,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw Error(
      "The security scanner is unavailable. The file remains quarantined.",
    );
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== "object" ||
    !("sha256" in result) ||
    result.sha256 !== sha256 ||
    !("status" in result) ||
    !["clean", "infected"].includes(String(result.status))
  )
    throw Error(
      "The scanner did not return a matching result. The file remains quarantined.",
    );
  return result.status === "clean" ? "clean" : "rejected";
}
