// Undefined means the database upgrade is unavailable. Null means the owner
// must choose; never infer a migrated stage's purpose from its editable name.
export const stagePurposes = {
  progress: "Ordinary progress",
  contract: "Signed contract verification",
  deposit: "50% deposit verification",
  contract_deposit: "Contract and deposit verification",
  final_approval: "Final creative approval verification",
  final_payment: "Final payment verification",
} as const;
export type StagePurpose = keyof typeof stagePurposes;
