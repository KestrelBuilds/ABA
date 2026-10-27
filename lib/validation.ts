import { z } from "zod";
export const clientInput = z.object({
  name: z.string().trim().min(1).max(120),
  contact: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  sector: z.string().trim().max(120),
});
export const projectInput = z.object({
  name: z.string().trim().min(1).max(120),
  clientId: z.uuid(),
  type: z.enum(["Brand Identity", "Website Design", "Both"]),
  due: z.iso.date(),
  budget: z.coerce.number().min(0).max(10000000),
});
export const stageInput = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  status: z.enum([
    "Not Started",
    "In Progress",
    "Awaiting Client",
    "Awaiting Approval",
    "Completed",
    "On Hold",
  ]),
  visible: z.boolean(),
});
export const feedbackInput = z.object({
  documentId: z.uuid(),
  body: z.string().trim().min(1).max(4000),
  decision: z.enum(["comment", "changes_requested", "approved"]),
});
export const questionnaireInput = z.object({
  projectId: z.uuid(),
  kind: z.enum(["brand", "website", "goodbye"]),
  answers: z
    .record(z.string().max(80), z.string().trim().min(1).max(4000))
    .refine((a) => Object.keys(a).length > 0 && Object.keys(a).length <= 20),
});
export const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
});
export const uuid = z.uuid();
export const allowedFiles = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];
export function validateFile(file: File) {
  if (
    !file.size ||
    file.size > 3 * 1024 * 1024 ||
    !allowedFiles.includes(file.type)
  )
    throw Error("Choose a PDF, PNG, JPEG or WebP file up to 3 MB.");
}
