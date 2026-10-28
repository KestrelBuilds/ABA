import type { ProjectType } from "./projects";
export const essentials = [
  ["business", "What does your business do, and who do you help?"],
  ["goal", "What would you like this project to achieve?"],
  [
    "audience_action",
    "What is the most important action you want your audience to take?",
  ],
  ["success", "How will we recognise a successful result?"],
] as const;
const branding = [
  [
    "positioning",
    "What makes your business different? Who are your main competitors?",
  ],
  [
    "personality",
    "Choose three words that describe how your brand should feel, and explain why.",
  ],
  [
    "direction",
    "Share optional references and explain what you like. Are there existing colours or assets to retain?",
  ],
  [
    "boundaries",
    "Are there symbols, colours or styles you would like me to explore or avoid?",
  ],
  [
    "applications",
    "Where will you use the logo and brand assets: website, social media, signage, print or packaging?",
  ],
] as const;
const website = [
  [
    "purpose",
    "Is this a new website or a redesign? What currently works or causes problems?",
  ],
  [
    "pages",
    "Which pages do you need? Do you need bookings, forms, a shop, a blog or other integrations?",
  ],
  [
    "content",
    "Who will provide copy, photographs, pricing and policies? What is already ready?",
  ],
  [
    "references",
    "Share up to three reference websites. What specifically do you like about them?",
  ],
  [
    "arrangements",
    "Do you already have a domain and hosting? Who will manage the website after launch?",
  ],
] as const;
export const prompts = {
  brand: [...essentials, ...branding],
  website: [...essentials, ...website],
  goodbye: [
    ["experience", "How was your experience working with me?"],
    ["improve", "What could I improve?"],
    ["next", "What are your next steps?"],
  ],
} as const;
export function questionnairePrompts(
  kind: keyof typeof prompts,
  type?: ProjectType,
): ReadonlyArray<readonly [string, string]> {
  return kind === "website" && type === "Both" ? website : prompts[kind];
}
export function optionalQuestion(kind: keyof typeof prompts, key: string) {
  return kind === "brand" && key === "direction";
}
export function requireCompleteAnswers(
  kind: keyof typeof prompts,
  answers: Record<string, string>,
  type?: ProjectType,
) {
  const required = new Set(
    questionnairePrompts(kind, type).map(([key]) => key),
  );
  if (
    [...required].some(
      (key) => !optionalQuestion(kind, key) && !answers[key]?.trim(),
    ) ||
    Object.keys(answers).some((key) => !required.has(key))
  )
    throw Error(
      "Please complete every questionnaire question before sending. Short answers are welcome; say if you are unsure.",
    );
}
