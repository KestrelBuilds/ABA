import { SaxesParser } from "saxes";
// SVGs are downloaded as attachments, never rendered in the portal. Reject active
// content and external resources as well as malformed XML; this is not malware scanning.
export function inspectSvg(bytes: Buffer) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  let root = false;
  const parser = new SaxesParser({ xmlns: true });
  const cssSafe = (value: string) => {
    if (/@import|expression\s*\(|javascript:|\\/i.test(value)) return false;
    return [...value.matchAll(/url\s*\(([^)]*)\)/gi)].every((match) =>
      /^#[a-z0-9_.:-]+$/i.test(match[1].trim().replace(/^(['"])(.*)\1$/, "$2")),
    );
  };
  parser.on("doctype", () => {
    throw Error("Export SVG without a DOCTYPE or external entities.");
  });
  parser.on("error", () => {
    throw Error("This SVG is not valid XML.");
  });
  parser.on("opentag", (tag) => {
    if (!root) {
      if (tag.local !== "svg" || tag.uri !== "http://www.w3.org/2000/svg")
        throw Error("Choose an SVG drawing.");
      root = true;
    }
    if (
      tag.uri !== "http://www.w3.org/2000/svg" ||
      /^(script|foreignObject|iframe|object|embed|animate.*|set)$/i.test(
        tag.local,
      )
    )
      throw Error("Export a static SVG without active content.");
    for (const attribute of Object.values(tag.attributes)) {
      const key = attribute.name.toLowerCase(),
        value = attribute.value.trim();
      if (
        /^on/i.test(attribute.local) ||
        key === "xml:base" ||
        !cssSafe(value) ||
        ((attribute.local === "href" || attribute.local === "src") &&
          !/^#/.test(value) &&
          !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(value))
      )
        throw Error("Export SVG without scripts or external resources.");
    }
  });
  parser.on("text", (value) => {
    if (!cssSafe(value))
      throw Error("Export SVG without external styles or resources.");
  });
  parser.on("cdata", (value) => {
    if (!cssSafe(value))
      throw Error("Export SVG without external styles or resources.");
  });
  parser.on("processinginstruction", (value) => {
    if (value.target.toLowerCase() !== "xml")
      throw Error("Export SVG without external stylesheets.");
  });
  parser.write(text).close();
  if (!root) throw Error("Choose an SVG drawing.");
}
export async function validateHandoverFile(file: File) {
  if (!file.size || file.size > 3 * 1024 * 1024)
    throw Error("Choose a handover file up to 3 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (/[\\/\u0000-\u001f]/.test(file.name) || file.name.length > 180)
    throw Error("Choose a normal file name.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (ext === "ai") {
    const header = bytes.subarray(0, 16).toString("latin1");
    if (
      !(header.startsWith("%PDF-") || header.startsWith("%!PS-Adobe")) ||
      ![
        "",
        "application/octet-stream",
        "application/pdf",
        "application/postscript",
        "application/illustrator",
        "application/vnd.adobe.illustrator",
      ].includes(file.type)
    )
      throw Error("Choose a PDF-compatible or PostScript Illustrator file.");
    return "application/postscript";
  }
  if (ext === "svg") {
    if (
      ![
        "",
        "application/octet-stream",
        "image/svg+xml",
        "text/xml",
        "application/xml",
      ].includes(file.type)
    )
      throw Error("Choose an SVG drawing.");
    inspectSvg(bytes);
    return "image/svg+xml";
  }
  throw Error("Choose an Illustrator or SVG handover file.");
}
