import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export function storageWasDenied(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; statusCode?: string };
  // Network failures, timeouts and provider 5xx responses must never count as access protection.
  return [400, 401, 403, 404].includes(Number(e.statusCode ?? e.status));
}
export async function assertStorageDenied(
  client: SupabaseClient,
  path: string,
  step: string,
) {
  const downloaded = await client.storage.from("project-files").download(path);
  if (downloaded.data || !storageWasDenied(downloaded.error))
    throw new Error(step + " did not pass.");
  const signed = await client.storage
    .from("project-files")
    .createSignedUrl(path, 60);
  if (signed.data || !storageWasDenied(signed.error))
    throw new Error(step + " (signed link) did not pass.");
}
export function fictionalPdf(): string {
  const content =
    "BT /F1 12 Tf 40 100 Td (ABA Studio fictional storage check.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  return (
    pdf +
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  );
}
export async function assertStoredBytes(
  client: SupabaseClient,
  path: string,
  expected: string,
) {
  const file = await client.storage.from("project-files").download(path);
  if (file.error || !file.data || (await file.data.text()) !== expected)
    throw new Error("Private file download/content verification did not pass.");
}
export async function assertSignedDownload(
  client: SupabaseClient,
  path: string,
  expected: string,
  origin: string,
  fetchFile: typeof fetch = fetch,
) {
  const signed = await client.storage
    .from("project-files")
    .createSignedUrl(path, 60, { download: "aba-fictional-check.pdf" });
  if (signed.error || !signed.data)
    throw new Error("Private download link could not be created.");
  if (new URL(signed.data.signedUrl).origin !== new URL(origin).origin)
    throw new Error("Private download link has an unexpected destination.");
  const response = await fetchFile(signed.data.signedUrl, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok || (await response.text()) !== expected)
    throw new Error("Signed file download/content verification did not pass.");
}
export async function checkPrivateStorage(
  owner: SupabaseClient,
  client: SupabaseClient,
  other: SupabaseClient,
  anonymous: SupabaseClient,
  project: string,
  documentIds: string[],
  origin: string,
) {
  const pdf = fictionalPdf();
  const paths = documentIds.map((id) => project + "/" + id);
  for (const path of paths) {
    const upload = await owner.storage
      .from("project-files")
      .upload(path, new TextEncoder().encode(pdf), {
        contentType: "application/pdf",
        upsert: false,
      });
    if (upload.error)
      throw new Error(
        "Private PDF upload failed. Check the project-files bucket and upload policies.",
      );
  }
  await assertStoredBytes(client, paths[0], pdf);
  await assertSignedDownload(client, paths[0], pdf, origin);
  await assertStorageDenied(other, paths[0], "Other-client file protection");
  await assertStorageDenied(anonymous, paths[0], "Anonymous file protection");
  await assertStorageDenied(client, paths[1], "Unpublished file protection");
  await assertStorageDenied(client, paths[2], "Unpaid final file protection");
  const paid = await owner
    .from("projects")
    .update({ final_paid: true })
    .eq("id", project);
  if (paid.error) throw new Error("Temporary payment setup failed.");
  await assertStorageDenied(
    client,
    paths[2],
    "Unapproved final file protection",
  );
  const approved = await owner
    .from("projects")
    .update({ final_approved: true })
    .eq("id", project);
  if (approved.error) throw new Error("Temporary approval setup failed.");
  await assertStoredBytes(client, paths[2], pdf);
  await assertSignedDownload(client, paths[2], pdf, origin);
}
