import type { DbProject, DbStage, WorkspaceData } from "./workspace";
import { fileVisibility } from "./file-visibility";
import {
  stageVerification,
  type VerificationField,
} from "./journey-verification";
export function stageFileDefaults(stage: Pick<DbStage, "name" | "stream">) {
  const n = stage.name.trim().toLowerCase();
  if (
    n === "goodbye packet" ||
    (n === "launch & handover" && stage.stream === "Website Design")
  )
    return { role: "Handover", category: "final" };
  if (stage.stream === "Onboarding") {
    if (n === "project proposal")
      return { role: "Proposal", category: "document" };
    if (["contract", "contract and deposit"].includes(n))
      return { role: "Contract", category: "document" };
    if (n === "invoice") return { role: "Invoice", category: "document" };
  }
  return { role: "General", category: "document" };
}
export function handoverPreparation(data: WorkspaceData, project: DbProject) {
  const stages = data.stages.filter((s) => s.project_id === project.id);
  const goodbye = stages.filter(
    (s) => s.name.trim().toLowerCase() === "goodbye packet",
  );
  const documents = data.documents.filter((d) => d.project_id === project.id);
  const finals = documents.filter((d) => d.category === "final");
  const packets = documents.filter((d) =>
    goodbye.some((s) => s.id === d.stage_id),
  );
  const readyFiles = finals.filter(
    (d) =>
      fileVisibility(
        d,
        project,
        stages,
        data.contractExchanges,
        data.prospectSpaces,
      ).available,
  );
  const missing = (
    [
      ["contract_signed", "Signed contract"],
      ["deposit_paid", "50% deposit"],
      ["final_approved", "Final creative approval"],
      ["final_paid", "Final payment"],
    ] as const
  ).filter(([field]) => !project[field]);
  const verificationStage = stages.find((s) =>
    missing.some(([field]) =>
      stageVerification(s).includes(field as VerificationField),
    ),
  );
  return {
    finals,
    packets,
    readyFiles,
    missing,
    packetHref: goodbye.length === 1 ? "#stage-" + goodbye[0].id : "#journey",
    checksHref: verificationStage
      ? "#stage-" + verificationStage.id
      : "#project-verification",
    hasHandoverNotes: Boolean(
      data.handovers?.find((h) => h.project_id === project.id)?.body.trim(),
    ),
    hasSupport: Boolean(
      data.projectDetails
        ?.find((d) => d.project_id === project.id)
        ?.support.trim(),
    ),
    packetNeedsReleaseRule: packets.some((d) => d.category !== "final"),
  };
}
export function goodbyeOutline(type: DbProject["type"]): string {
  const brand = type !== "Website Design",
    website = type !== "Brand Identity";
  return [
    "ALEX BELL ARTS — GOODBYE PACKET DRAFT",
    "Owner draft: replace every [placeholder], remove anything outside the agreed scope, and design the finished PDF in Illustrator. This draft is not shared with the client.",
    "\nTHANK YOU",
    "Thank you for trusting me with [project / business name]. This guide brings together your agreed final delivery, useful next steps and support details.",
    "\nYOUR FINAL DELIVERY",
    "[List the exact files / links included in the agreed delivery and explain where the client can find them in their portal.]",
    ...(brand
      ? [
          "\nUSING YOUR BRAND FILES",
          "[List the logo variations actually supplied and when each should be used.]",
          "SVG files scale without losing sharpness. PNG files can include transparent backgrounds. JPEG files are generally suited to photographs or flat-background images. Use each PDF for its stated purpose. Only mention formats included in this project.",
          "[Add the brand guidelines location, colour references and font names. State which font or stock licences the client must hold; do not bundle or promise licences that are not included.]",
          "[Explain the agreed file backup arrangements and anything the client should keep unchanged.]",
        ]
      : []),
    ...(website
      ? [
          "\nYOUR FRAMER WEBSITE",
          "[Add the live website URL and the agreed Framer project ownership/access arrangements.]",
          "[Confirm whether project transfer, launch and domain connection have actually been completed. Do not present a checklist as proof of completion.]",
          "[State who controls the domain and Framer billing, which plan/renewals apply, and who is responsible for connected services. Use the accepted proposal; do not assume hosting is included.]",
          "\nMAKING WEBSITE UPDATES",
          "[Add the client’s agreed editing guide or walkthrough link: changing text/images, editing CMS content if included, previewing and publishing.]",
          "[Explain any sections they should discuss with me before changing, and how to invite collaborators securely. Do not include passwords or account tokens.]",
          "[List the forms, booking links and integrations actually included, with their account owner and agreed maintenance responsibilities.]",
        ]
      : []),
    "\nSUPPORT & NEXT STEPS",
    "[Copy the support period, contact method, exclusions and ongoing responsibilities from the accepted agreement. If these are not agreed yet, confirm them before sharing this packet.]",
    "If you need help, contact me through [agreed contact method] with the file or page affected and a description of what you need. I’ll confirm the scope, timing and any cost before starting additional work.",
    "\nYOUR FEEDBACK",
    "I’d love to hear how the project went. You can share feedback using the goodbye form in your portal after final release.",
    "\nTHANK YOU AGAIN",
    "[Add your personal closing message.]",
    "Alex · Alex Bell Arts",
  ].join("\n\n");
}
