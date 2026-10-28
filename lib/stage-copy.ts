export function stageGuidance(name: string) {
  const n = name.toLowerCase();
  if (n.includes("discovery call"))
    return "Book the initial conversation using the booking link when one is available. I’ll use this call to discuss your goals, scope and next steps.";
  if (n.includes("proposal"))
    return "Open the project proposal PDF below and review the scope, deliverables, timeline and revision allowance. Contact me about anything you would like clarified.";
  if (n.includes("contract"))
    return "Download the contract PDF and complete/sign it in Adobe Acrobat or the agreed signing tool. Save and upload the completed PDF back to this stage when portal access is available; before that, return it by the agreed email process. I’ll review and verify the signed contract and receipt of the deposit before enabling onboarding.";
  if (n.includes("invoice"))
    return "Open your invoice PDF and follow the payment instructions. Uploading a document does not confirm payment; I’ll update the payment record after checking receipt.";
  if (n.includes("questionnaire") || n.includes("brief"))
    return "Complete the relevant project brief below. Short answers are welcome. Please do not upload passwords or payment-card details.";
  if (n.includes("approval") || n.includes("feedback") || n.includes("review"))
    return "Review the exact presentation version below and send one consolidated set of feedback. Creative approval is recorded against the file you reviewed, not as a legal signature.";
  if (n.includes("delivery") || n.includes("handover"))
    return "Final files and handover follow the agreed approval and payment conditions. Open the released files below and keep a copy for your records.";
  return "I’ll add the relevant instructions, presentations and documents for this stage here. Check your project actions for anything I need from you.";
}
