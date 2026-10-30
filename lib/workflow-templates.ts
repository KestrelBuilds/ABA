import type { StagePurpose } from "./stage-purpose";
import type { ProjectType } from "./projects";
// Live project templates follow Alex's supplied folder order. Existing projects
// and the separate fictional demo snapshot are never rewritten by template edits.
export const sharedProjectStages = [
  "Enquiry Stage",
  "Project Proposal",
  "Onboarding",
  "Contract",
  "Invoice",
] as const;
export const brandProjectStages = [
  "Creative Direction",
  "Logo Design",
  "Logo Presentation",
  "Brand Touchpoints",
  "Brand Guidelines",
] as const;
export const websiteProjectStages = [
  "Website Brief & Content",
  "Page Structure & Layout",
  "Website Design",
  "Framer Build & Review",
  "Launch & Handover",
] as const;
export function newProjectStages(type: ProjectType) {
  return [
    ...sharedProjectStages.map((name) => ({
      name,
      stream: "Onboarding",
      purpose: (name === "Contract"
        ? "contract"
        : name === "Invoice"
          ? "deposit"
          : "progress") as StagePurpose,
    })),
    ...(type !== "Website Design"
      ? brandProjectStages.map((name) => ({ name, stream: "Brand Identity" }))
      : []),
    ...(type !== "Brand Identity"
      ? websiteProjectStages.map((name) => ({ name, stream: "Website Design" }))
      : []),
    { name: "Goodbye Packet", stream: "Delivery" },
  ].map((stage) => ({ purpose: "progress" as StagePurpose, ...stage }));
}
