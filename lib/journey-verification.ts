import type { DbProject, DbStage } from "./workspace";
export const verificationLabels = {
  contract_signed: "Contract signed — I have checked the signed contract",
  deposit_paid: "50% deposit received — I have verified the payment",
  final_approved:
    "Final creative approval verified across all project workstreams",
  final_paid: "Final 50% received — I have verified the payment",
} as const;
export type VerificationField = keyof typeof verificationLabels;
// Match only known template labels. Never guess legal/payment meaning from arbitrary names.
export function stageVerification(
  stage: Pick<DbStage, "name" | "stream">,
): VerificationField[] {
  const name = stage.name.trim().toLowerCase();
  if (stage.stream === "Onboarding" && name === "contract")
    return ["contract_signed"];
  if (stage.stream === "Onboarding" && name === "invoice")
    return ["deposit_paid"];
  if (stage.stream === "Onboarding" && name === "contract and deposit")
    return ["contract_signed", "deposit_paid"];
  if (["Brand Identity", "Website Design"].includes(stage.stream)) {
    if (["final review and approval", "final approval"].includes(name))
      return ["final_approved"];
    if (name === "final invoice") return ["final_paid"];
  }
  return [];
}
export function verifiedStageStatus(
  stage: DbStage,
  project: DbProject,
): string {
  const fields = stageVerification(stage);
  if (!fields.length) return stage.status;
  if (fields.every((field) => project[field])) return "Completed";
  return fields.some((field) => project[field])
    ? "In Progress"
    : "Awaiting verification";
}
