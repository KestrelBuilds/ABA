export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const uploadAccept = ".pdf,.png,.jpg,.jpeg,.webp,.ai,.zip";
export function uploadMime(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    ai: "application/postscript",
    zip: "application/zip",
  };
  if (
    !ext ||
    !types[ext] ||
    /[\\/\u0000-\u001f]/.test(name) ||
    name.length > 180
  )
    throw Error(
      "Choose a PDF, PNG, JPEG, WebP, Illustrator or ZIP file with a normal file name.",
    );
  return types[ext];
}
export function fileAvailable(file: { scan_state?: string }) {
  return !file.scan_state || ["legacy", "clean"].includes(file.scan_state);
}

// Signals that an upload reservation exists even though its check did not finish.
export class UploadPendingError extends Error {}
