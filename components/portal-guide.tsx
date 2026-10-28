import type { DbProject, DbStage, ClientAction } from "@/lib/workspace";
export default function PortalGuide({
  project,
  stages,
  part = "overview",
  assetsReady = false,
  clientActions = [],
}: {
  project: DbProject;
  stages: DbStage[];
  part?: "overview" | "reference";
  assetsReady?: boolean;
  clientActions?: ClientAction[];
}) {
  const visible = stages.filter(
    (s) => s.project_id === project.id && s.visible,
  );
  const current = visible.find((s) => s.status !== "Completed");
  const action = visible.find((s) =>
    ["Awaiting Client", "Awaiting Approval"].includes(s.status),
  );
  const nextAction = clientActions.find(
    (a) => a.project_id === project.id && a.status !== "Done",
  );
  const sections = [
    [
      "questionnaires",
      "Project brief & onboarding",
      "Your goals, agreed brief and onboarding.",
    ],
    [
      assetsReady ? "client-assets" : "content-assets",
      "Content & assets",
      "Copy, images and brand files.",
    ],
    [
      "documents",
      "Documents & payments",
      "Your project documents and payment information.",
    ],
    [
      "documents",
      "Design reviews & approvals",
      "Presentations, feedback and decisions.",
    ],
    [
      "handover",
      "Handover & support",
      "Final work, guidance and agreed support.",
    ],
    [
      "working-together",
      "Help & working together",
      "Quick answers and how to contact me.",
    ],
  ];
  return (
    <div className="notion-portal">
      {part === "overview" && (
        <>
          <div className="client-focus">
            <section>
              <span className="eyebrow">YOUR NEXT ACTION</span>
              <h3>
                {nextAction?.title ??
                  action?.name ??
                  "Check your brief and project documents"}
              </h3>
              <p>
                {nextAction
                  ? nextAction.due
                    ? "Due " +
                      new Date(nextAction.due + "T12:00:00").toLocaleDateString(
                        "en-GB",
                      )
                    : "Date to be agreed with me."
                  : action
                    ? "Please review the relevant presentation or request below."
                    : "Only complete the questions for your agreed service. Short answers are welcome."}
              </p>
            </section>
            <section>
              <span className="eyebrow">CURRENT STAGE</span>
              <h3>{current?.name ?? "Your milestones are complete"}</h3>
              <p>{current?.status ?? "I’ll confirm the next step with you."}</p>
            </section>
            <section>
              <span className="eyebrow">NEXT MILESTONE</span>
              <h3>
                {visible.find((s) => s.status === "Not Started")?.name ??
                  "Review your project journey"}
              </h3>
              <p>
                Individual milestone dates are confirmed with me. Your estimated
                project completion is shown below.
              </p>
            </section>
          </div>
          <h2>Everything for your project</h2>
          <div className="portal-section-grid">
            {sections.map(([id, title, description]) => (
              <a key={title} href={"#" + id}>
                <h3>{title}</h3>
                <p>{description}</p>
                <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </>
      )}{" "}
      {part === "reference" && (
        <>
          <section className="panel" id="content-assets">
            <h2>Content & assets</h2>
            <p>
              Everything I need to create your project. I’ll confirm an agreed
              sharing method for your files and approved content; keep filenames
              clear and identify the latest approved version.
            </p>
            <h3>Brand assets</h3>
            <ul>
              <li>Existing logos and guidelines, if available.</li>
              <li>
                Established colours, fonts and relevant font or stock-asset
                licences.
              </li>
            </ul>
            {project.type !== "Brand Identity" && (
              <>
                <h3>Website content</h3>
                <ul>
                  <li>
                    Final business details, approved page copy, services and
                    prices.
                  </li>
                  <li>
                    Photographs, image credits and testimonials approved for
                    publication.
                  </li>
                  <li>
                    Booking links and client-supplied privacy, terms and policy
                    content.
                  </li>
                </ul>
                <p>
                  For each page, include its name, purpose, approved text, main
                  action or button, and relevant images and links.
                </p>
              </>
            )}
            <p>
              If I need access to Framer, a domain provider or another service,
              I’ll explain how to invite me. Please don’t paste passwords or
              payment details into your answers.
            </p>
          </section>
          <section className="panel" id="handover">
            <h2>Handover & support</h2>
            <p>
              Once the agreed work is complete and approved, I’ll issue the
              invoice for the remaining 50%. Final files or website handover
              follow receipt of that payment, in line with the contract.
            </p>
            {project.type !== "Website Design" && (
              <>
                <h3>Branding handover</h3>
                <p>
                  Your agreed logo formats, guidelines, applications and
                  relevant font/licence information will be included in the
                  final delivery. SVG is scalable, PNG can support transparency,
                  JPEG is generally used for photography, and PDFs are prepared
                  for their intended use. AI/EPS files are included only where
                  agreed.
                </p>
              </>
            )}
            {project.type !== "Brand Identity" && (
              <>
                <h3>Website handover</h3>
                <p>
                  I’ll confirm the live website, Framer transfer/access, domain
                  and hosting renewal responsibilities, connected services and
                  editing guidance as agreed in your proposal.
                </p>
              </>
            )}
            <h3>Ongoing support</h3>
            <p>
              Your accepted proposal and handover documents define any included
              support, maintenance and ongoing costs. If you need help, contact
              me with the page or file affected and a description of the issue.
            </p>
            {project.final_paid && project.final_approved && (
              <a
                className="resource"
                href="https://tally.so/r/Z9jk9o"
                target="_blank"
                rel="noreferrer"
              >
                Leave your project feedback & review ↗
              </a>
            )}
          </section>
          <section className="panel" id="working-together">
            <h2>Help & working together</h2>
            {[
              [
                "Where should I start?",
                "Open Project brief & onboarding, then check your next action and project journey.",
              ],
              [
                "Where do I give feedback?",
                "Use the relevant design presentation below. Please collect feedback into one consolidated set, with your nominated approver confirming the decision. Each uploaded revision is a separate document; feedback is tied to that exact file.",
              ],
              [
                "How many revisions are included?",
                "Your proposal states the allowance. I’ll explain any extra work and associated cost before proceeding.",
              ],
              [
                "What if content or feedback is delayed?",
                "Tell me as soon as you can. I’ll discuss the effect on the schedule and confirm a revised plan.",
              ],
              [
                "Do I need to complete every questionnaire?",
                "Only complete the questions for your agreed service. Short answers are welcome, and I can explore uncertain points with you.",
              ],
              [
                "How do I book a call?",
                "Contact me by project email. I can use Zoom or Discord, as agreed.",
              ],
              [
                "Who pays for domains, hosting or fonts?",
                "These costs are only included where the proposal explicitly says so. I’ll confirm responsibilities in your proposal and handover.",
              ],
              [
                "Can I request something outside the original scope?",
                "Yes. I’ll explain any additional cost and timing before you decide.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

export function ReviewChecklist({ type }: { type: DbProject["type"] }) {
  return (
    <details className="review-checklist">
      <summary>Before confirming approval</summary>
      {type !== "Website Design" && (
        <>
          <h4>Branding review</h4>
          <ul>
            <li>Business name and tagline checked.</li>
            <li>Agreed logo variations and colours reviewed.</li>
            <li>Typography and relevant licence arrangements confirmed.</li>
            <li>Guidelines and included applications reviewed.</li>
            <li>Approval refers to this exact presentation.</li>
          </ul>
        </>
      )}
      {type !== "Brand Identity" && (
        <>
          <h4>Website review</h4>
          <ul>
            <li>Desktop and mobile layouts reviewed.</li>
            <li>Business details, prices, spelling and links checked.</li>
            <li>Forms and booking journeys tested.</li>
            <li>Images and content approved for publication.</li>
            <li>Launch approval refers to this exact version.</li>
          </ul>
        </>
      )}
    </details>
  );
}
