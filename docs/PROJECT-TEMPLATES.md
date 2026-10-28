# Project and folder templates

These are the live templates for newly created projects. Existing projects, their stage IDs, customisations and uploaded files are preserved. The separate `/demo` retains its older fictional snapshot. Folder prefixes are suggestions for Alex’s external files; ABA uses the stage names and saved order.

## Brand Identity

Matches Alex’s supplied folder screenshot, with the requested Goodbye Packet added.

```text
CLI001 Enquiry Stage
CLI002 Project Proposal
CLI003 Onboarding
CLI004 Contract
CLI005 Invoice
CLI006 Creative Direction
CLI007 Logo Design
CLI008 Logo Presentation
CLI009 Brand Touchpoints
CLI010 Brand Guidelines
CLI011 Goodbye Packet
```

## Website Design — Framer

```text
WEB001 Enquiry Stage
WEB002 Project Proposal
WEB003 Onboarding
WEB004 Contract
WEB005 Invoice
WEB006 Website Brief & Content
WEB007 Page Structure & Layout
WEB008 Website Design
WEB009 Framer Build & Review
WEB010 Launch & Handover
WEB011 Goodbye Packet
```

- **Website Brief & Content:** goals, audience, page needs, approved text/images and existing brand assets. The website questionnaire is used; there is no branding/logo questionnaire for website-only work.
- **Page Structure & Layout:** agree pages, navigation and the main content/layout flow. Avoid unnecessary technical documentation for a small Framer site.
- **Website Design:** visual direction, typography, colour and page design, with the agreed feedback rounds.
- **Framer Build & Review:** build the design in Framer, check desktop/mobile layouts, links/forms and complete agreed refinements. Responsive/functional checks still happen inside this stage; they have not been removed from delivery.
- **Launch & Handover:** after verified final approval/payment, complete the agreed domain/launch and ownership handover. Framer hosting, domain costs and continuing support are defined by the proposal, not invented by this template.
- **Goodbye Packet:** Alex will supply the actual packet later. Attach its PDF/support information here when ready; the external/native goodbye feedback links retain their final-approval/payment gates. The template does not create or claim to contain the packet.

## Shared controls and combined work

Enquiry Stage includes the public Calendly discovery-call link; it is not an API integration. Onboarding is preparation/welcome/questionnaires, which can be prepared before contract/deposit verification. It does not itself grant full portal access. A combined project links both relevant questionnaires, with shared essentials asked once using the existing form rules.

Contract and Invoice are separate stages. Contract completion derives from the signed-contract verification; Invoice completion derives from verified deposit receipt. Uploading or changing progress does not verify either. Store the deposit and later final invoice PDFs in Invoice as appropriate; the stage’s completion refers to the deposit, not the final balance.

Final creative approval and final-payment verification remain in **Project verification checks** at the top of the journey, with the side panel read-only. Final deliverables and goodbye forms keep their original access rules. Goodbye Packet remains an ordinary task: payment approval does not claim the actual packet has been written/sent.

Combined projects have the five shared opening stages, five branding stages, five website stages and one shared Goodbye Packet (16 total). Creative workstreams retain their separate labels. Global final approval explicitly covers both workstreams.

No additional SQL is required for the template update. Migration 202610280006 is still required separately for the restricted initial contract area; see CONTRACT-AREA.md. Existing projects can be edited individually, but this change does not automatically merge, remove or rename any of their stages or attachments.
