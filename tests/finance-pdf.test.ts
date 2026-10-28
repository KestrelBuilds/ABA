import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { execFileSync } from "node:child_process";
import { businessPdf } from "../lib/finance/pdf";
import type { Proposal, Invoice } from "../lib/finance/data";
const seller = {
  name: "Alex Bell trading as Alex Bell Arts",
  address: "Fictional business address",
  email: "example@example.com",
  tax_note: "No VAT charged",
  payment_instructions: "Use the agreed payment method",
};
const client = {
  name: "Élan Fictional Studio",
  address: "Fictional billing address",
};
test("proposal PDFs preserve Unicode, exact split amounts, draft label and all long-form content", async () => {
  const p = {
    status: "Draft",
    revision: 1,
    total_pence: 10101,
    scope: "Considered design. ".repeat(450) + "END OF SCOPE",
    deliverables: "Logo and guidelines",
    timeline: "Four weeks",
    revisions: "Two rounds",
    exclusions: "Printing",
    notes: "Fictional only",
  } as Proposal;
  const bytes = await businessPdf(
    "proposal",
    p,
    "Fictional brand project",
    client,
    seller,
  );
  const parsed = await PDFDocument.load(bytes);
  assert.ok(parsed.getPageCount() > 2);
  const text = execFileSync("pdftotext", ["-", "-"], {
    input: Buffer.from(bytes),
    encoding: "utf8",
  });
  assert.match(text, /DRAFT/);
  assert.match(text, /Élan Fictional Studio/);
  assert.match(text, /£50.51/);
  assert.match(text, /£50.50/);
  assert.match(text, /END OF SCOPE/);
});
test("issued invoice PDFs include number, parties, dates, tax note and payment state", async () => {
  const i = {
    status: "Paid",
    kind: "Deposit",
    number: "ABA-2026-000001",
    amount_pence: 5051,
    issued_on: "2026-10-28",
    due_on: "2026-11-04",
    paid_on: "2026-10-28",
  } as Invoice;
  const bytes = await businessPdf(
    "invoice",
    i,
    "Fictional brand project",
    client,
    seller,
  );
  const text = execFileSync("pdftotext", ["-", "-"], {
    input: Buffer.from(bytes),
    encoding: "utf8",
  });
  for (const part of [
    "ABA-2026-000001",
    "£50.51",
    "£0.00",
    "No VAT charged",
    "Fictional billing address",
    "2026-11-04",
  ])
    assert.ok(text.includes(part), part);
  assert.ok(!text.includes("DRAFT"));
});
