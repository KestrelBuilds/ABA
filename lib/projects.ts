export const statuses = [
  "Not Started",
  "In Progress",
  "Awaiting Client",
  "Awaiting Approval",
  "Completed",
  "On Hold",
] as const;
export type Status = (typeof statuses)[number];
export type ProjectType = "Brand Identity" | "Website Design" | "Both";
export type Stage = {
  id: string;
  name: string;
  stream: string;
  status: Status;
  visible: boolean;
};
export type Client = {
  id: string;
  name: string;
  contact: string;
  email: string;
  sector: string;
};
export type Project = {
  id: string;
  name: string;
  clientId: string;
  type: ProjectType;
  due: string;
  budget: number;
  deposit: boolean;
  contract: boolean;
  finalPaid: boolean;
  stages: Stage[];
  activity: string[];
  notes: string;
};
export const acquisition = [
  "Enquiry",
  "Discovery Call",
  "Project Proposal",
  "Contract and Deposit",
  "Client Onboarding",
];
export const brand = [
  "Brand Discovery and Questionnaire",
  "Research and Creative Direction",
  "Logo Design and Concepts",
  "Concept Presentation and Feedback",
  "Brand Touchpoints",
  "Brand Guidelines",
  "Final Review and Approval",
  "Final Invoice",
  "Brand Delivery and Goodbye Pack",
];
export const website = [
  "Website Discovery and Brief",
  "Sitemap and Website Planning",
  "Wireframes",
  "Visual Website Design",
  "Website Development",
  "Responsive Testing and Quality Assurance",
  "Client Review and Revisions",
  "Final Approval",
  "Final Invoice",
  "Website Launch and Handover",
  "Goodbye Pack and Feedback",
];
export function createStages(type: ProjectType): Stage[] {
  return [
    ...acquisition.map((name) => ({ name, stream: "Onboarding" })),
    ...(type !== "Website Design"
      ? brand.map((name) => ({ name, stream: "Brand Identity" }))
      : []),
    ...(type !== "Brand Identity"
      ? website.map((name) => ({ name, stream: "Website Design" }))
      : []),
  ].map((s, i) => ({
    ...s,
    id: crypto.randomUUID(),
    status: i === 0 ? "In Progress" : "Not Started",
    visible: true,
  }));
}
export function progress(stages: Stage[]) {
  return stages.length
    ? Math.round(
        (stages.filter((s) => s.status === "Completed").length /
          stages.length) *
          100,
      )
    : 0;
}
export const clients: Client[] = [
  {
    id: "c1",
    name: "Forma Objects",
    contact: "Olivia Reed",
    email: "olivia@forma.example",
    sector: "Objects & interiors",
  },
  {
    id: "c2",
    name: "Fieldwork Coffee",
    contact: "Elliot Hayes",
    email: "elliot@fieldwork.example",
    sector: "Food & beverage",
  },
  {
    id: "c3",
    name: "Serein House",
    contact: "Amelia Stone",
    email: "amelia@serein.example",
    sector: "Hospitality",
  },
];
export function seedProjects(): Project[] {
  return [
    {
      id: "p1",
      name: "An identity with intention",
      clientId: "c1",
      type: "Brand Identity",
      due: "2026-11-20",
      budget: 3200,
      deposit: true,
      contract: true,
      finalPaid: false,
      stages: createStages("Brand Identity").map((s, i) => ({
        ...s,
        status:
          i < 7 ? "Completed" : i === 7 ? "Awaiting Client" : "Not Started",
      })),
      activity: [
        "Creative direction approved",
        "Logo concepts shared for review",
      ],
      notes: "Explore tactile packaging applications.",
    },
    {
      id: "p2",
      name: "A fresh digital home",
      clientId: "c2",
      type: "Website Design",
      due: "2026-12-04",
      budget: 4800,
      deposit: true,
      contract: true,
      finalPaid: false,
      stages: createStages("Website Design").map((s, i) => ({
        ...s,
        status: i < 7 ? "Completed" : i === 7 ? "In Progress" : "Not Started",
      })),
      activity: ["Sitemap approved", "Wireframes in progress"],
      notes: "Framer build; content supplied by client.",
    },
  ];
}
export function clientStages(project: Project) {
  return project.stages.filter((s) => s.visible);
}
export function portalAvailable(project: Project) {
  return project.contract && project.deposit;
}
export function deliveryAvailable(project: Project) {
  const approvals = project.stages.filter((s) =>
    /Final (Review and )?Approval/.test(s.name),
  );
  return (
    project.deposit &&
    project.finalPaid &&
    approvals.length > 0 &&
    approvals.every((s) => s.status === "Completed")
  );
}
