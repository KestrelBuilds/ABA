import { studioContactHref } from "@/lib/studio-contact";

export default function ContactAlex({
  label = "Email Alex for help",
}: {
  label?: string;
}) {
  return (
    <a className="resource" href={studioContactHref}>
      {label}
    </a>
  );
}
