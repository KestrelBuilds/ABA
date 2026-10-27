export const prompts = {
  brand: [
    ["business", "Tell me about your business and what makes it different."],
    ["audience", "Who would you like to reach?"],
    ["direction", "What should your new identity communicate?"],
  ],
  website: [
    ["goals", "What should your website help your business achieve?"],
    ["pages", "Which pages and features do you need?"],
    ["content", "What content and branding assets are ready?"],
    ["references", "Which websites inspire you and why?"],
  ],
  goodbye: [
    ["experience", "How was your experience working with me?"],
    ["improve", "What could I improve?"],
    ["next", "What are your next steps?"],
  ],
} as const;

export function requireCompleteAnswers(
  kind: keyof typeof prompts,
  answers: Record<string, string>,
) {
  const required = new Set<string>(prompts[kind].map(([key]) => key));
  if (
    [...required].some((key) => !answers[key]?.trim()) ||
    Object.keys(answers).some((key) => !required.has(key))
  )
    throw Error("Please complete every questionnaire question before sending.");
}
