import { largeFileContactEmail } from "@/lib/studio-contact";

export default function LargeFileHelp({
  oversized = false,
}: {
  oversized?: boolean;
}) {
  return (
    <span>
      {oversized
        ? "Please email it to "
        : "If your file is larger than 3 MB, email it to "}
      <a href={"mailto:" + largeFileContactEmail}>{largeFileContactEmail}</a>.
    </span>
  );
}
