export function bookingUrl(value: string) {
  if (!value.trim()) return "";
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw Error("Enter a valid Calendly HTTPS booking link.");
  }
  if (
    url.protocol !== "https:" ||
    !["calendly.com", "www.calendly.com"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname === "/"
  )
    throw Error("Use a public https://calendly.com/ booking link.");
  return url.href;
}

export const discoveryBookingUrl =
  "https://calendly.com/alex-bell-arts/new-meeting";
