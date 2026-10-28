export function stageGuidance(name: string) {
  const n = name.toLowerCase();
  if (n === "enquiry stage")
    return "Start with your enquiry and, when useful, book a discovery call using my Calendly link. I’ll confirm what you need before preparing your proposal.";
  if (n === "onboarding")
    return "Your welcome information and relevant project questionnaires live here. Prepare your brief and existing materials; full portal access opens after I verify the signed contract and deposit. For combined projects, shared business questions are asked once.";
  if (n === "creative direction")
    return "I’ll use your branding brief, research and references to develop the visual direction. Review the shared creative-direction PDF and send consolidated feedback.";
  if (n === "logo design")
    return "I’ll develop the logo concepts from the agreed creative direction. Your agreed scope and proposal define the work included.";
  if (n === "logo presentation")
    return "Review the logo presentation PDF and use its feedback and approval controls below. I’ll work through the agreed refinements with you.";
  if (n === "brand touchpoints")
    return "I’ll apply the identity to the touchpoints agreed in your proposal, such as stationery, social graphics or packaging. Review the shared PDFs here.";
  if (n === "brand guidelines")
    return "Your brand guidelines explain how to use the identity consistently. Review the shared PDF; final deliverables stay locked until I verify final creative approval and payment.";
  if (n === "website brief & content")
    return "Tell me about your website’s audience, goals and pages using the website brief. Return your approved copy, images and existing brand assets here. Website-only projects do not need branding questionnaires.";
  if (n === "page structure & layout")
    return "I’ll map out the pages, navigation and key layouts so we can agree the structure and content flow before detailed visual design.";
  if (n === "website design")
    return "I’ll develop the website’s visual design, typography, colours and key page layouts using your existing or newly approved identity. Share one consolidated set of feedback on the design presentation.";
  if (n === "framer build & review")
    return "I’ll build the agreed design in Framer, check desktop and mobile layouts, links and forms, and work through your agreed revisions. Framer remains the website platform; no custom software development is implied.";
  if (n === "launch & handover")
    return "After I verify final design approval and payment, I’ll complete the agreed Framer launch, domain connection and handover. Account ownership, hosting costs and support follow your proposal; access should be shared by invitation, never by uploading passwords.";
  if (n === "goodbye packet")
    return "Your goodbye packet belongs here: final handover/support information and the feedback form. I’ll add my packet when it is ready. Final files and goodbye feedback remain gated by verified final approval and payment; finishing this milestone does not itself release files.";
  if (n.includes("discovery call"))
    return "Book the initial conversation using the booking link when one is available. I’ll use this call to discuss your goals, scope and next steps.";
  if (n.includes("proposal"))
    return "Open the project proposal PDF below and review the scope, deliverables, timeline and revision allowance. Contact me about anything you would like clarified.";
  if (n.includes("contract"))
    return "Download the contract PDF and complete/sign it in Adobe Acrobat or the agreed signing tool. Save and upload the completed PDF in the initial contract area when I’ve invited you there, or return it to this stage after portal access opens. I’ll review and verify the signed contract and receipt of the deposit before enabling onboarding.";
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
