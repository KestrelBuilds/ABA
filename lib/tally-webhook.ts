import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
export function verifyTallySignature(
  body: string,
  signature: string | null,
  secret: string,
) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(body).digest("base64");
  const given = Buffer.from(signature, "utf8"),
    correct = Buffer.from(expected, "utf8");
  return given.length === correct.length && timingSafeEqual(given, correct);
}
const field = z.object({
  key: z.string().max(200),
  label: z.string().max(200).nullable().optional(),
  type: z.string().max(60),
  value: z.unknown(),
  options: z
    .array(z.object({ id: z.string(), text: z.string().max(4000) }))
    .max(100)
    .optional(),
});
const event = z.object({
  eventId: z.string().min(1).max(200),
  eventType: z.literal("FORM_RESPONSE"),
  data: z.object({
    formId: z.string().min(1).max(100),
    responseId: z.string().min(1).max(200),
    fields: z.array(field).max(100),
  }),
});
export function tallyEnquiry(body: string, formId: string) {
  const parsed = event.parse(JSON.parse(body));
  if (parsed.data.formId !== formId) throw Error("Unexpected form");
  const allowed = new Set([
    "INPUT_TEXT",
    "INPUT_EMAIL",
    "TEXTAREA",
    "INPUT_PHONE_NUMBER",
    "INPUT_LINK",
    "INPUT_NUMBER",
    "INPUT_DATE",
    "MULTIPLE_CHOICE",
    "DROPDOWN",
    "CHECKBOXES",
  ]);
  const fields = parsed.data.fields
    .filter((f) => allowed.has(f.type))
    .map((f) => {
      const items = Array.isArray(f.value) ? f.value : [f.value];
      const value = items
        .filter((v) => ["string", "number", "boolean"].includes(typeof v))
        .map((v) => f.options?.find((o) => o.id === v)?.text ?? String(v))
        .join(", ")
        .slice(0, 4000);
      return { key: f.key, label: f.label ?? f.key, type: f.type, value };
    });
  const email =
    fields.find(
      (f) => f.type === "INPUT_EMAIL" && z.email().safeParse(f.value).success,
    )?.value ?? "";
  const business =
    fields.find((f) =>
      /business|company|organisation|organization/i.test(f.label),
    )?.value ?? "";
  const contact =
    fields.find(
      (f) =>
        /name/i.test(f.label) &&
        !/business|company|organisation|organization/i.test(f.label),
    )?.value ?? "";
  return {
    source: "tally",
    event_id: parsed.eventId,
    form_id: parsed.data.formId,
    response_id: parsed.data.responseId,
    business_name: business.slice(0, 120),
    contact_name: contact.slice(0, 120),
    email: email.slice(0, 254),
    fields,
  };
}
