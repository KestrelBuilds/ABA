// Permission-sensitive reads must bypass both HTTP caching and Next.js request
// memoization. Next's dedupe-fetch explicitly opts out when a signal is present.
export function privateRequestOptions(options?: RequestInit): RequestInit {
  return {
    ...options,
    cache: "no-store",
    signal: options?.signal ?? AbortSignal.timeout(20000),
  };
}
export const privateFetch: typeof fetch = (input, options) =>
  fetch(input, privateRequestOptions(options));
