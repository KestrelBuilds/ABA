import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pounds, splitPayment } from "./money";
import type { Proposal, Invoice } from "./data";
export async function businessPdf(
  kind: "proposal" | "invoice",
  record: Proposal | Invoice,
  projectName: string,
  client: Record<string, string>,
  seller: Record<string, string>,
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await readFile(join(process.cwd(), "public/fonts/DejaVuSans.ttf")),
    { subset: true },
  );
  const mark = await pdf.embedPng(
    await readFile(join(process.cwd(), "public/brand/aba-mark.png")),
  );
  let page: PDFPage,
    y = 0;
  const pages: PDFPage[] = [];
  const newPage = () => {
    page = pdf.addPage([595, 842]);
    pages.push(page);
    page.drawImage(mark, { x: 42, y: 764, width: 52, height: 52 });
    page.drawText("ALEX BELL ARTS", {
      x: 108,
      y: 787,
      size: 10,
      font,
      color: rgb(0.067, 0.067, 0.067),
    });
    page.drawText("ABA Studio", {
      x: 108,
      y: 771,
      size: 9,
      font,
      color: rgb(0.42, 0.42, 0.42),
    });
    y = 738;
  };
  const line = (value: string, size = 10) => {
    if (y < 65) newPage();
    page.drawText(value, {
      x: 48,
      y,
      size,
      font,
      color: rgb(0.067, 0.067, 0.067),
    });
    y -= size + 7;
  };
  const paragraph = (text: string) => {
    for (const source of text.replace(/\r/g, "").split("\n")) {
      let current = "";
      for (const word of source.split(/\s+/)) {
        if (
          font.widthOfTextAtSize((current ? current + " " : "") + word, 10) <=
          495
        ) {
          current += (current ? " " : "") + word;
        } else {
          if (current) line(current);
          current = "";
          for (const char of word) {
            if (font.widthOfTextAtSize(current + char, 10) > 495) {
              line(current);
              current = "";
            }
            current += char;
          }
        }
      }
      line(current);
    }
    y -= 5;
  };
  const section = (title: string, text: string) => {
    if (y < 110) newPage();
    y -= 7;
    line(title, 12);
    paragraph(text || "To be confirmed.");
  };
  newPage();
  const draft = record.status === "Draft";
  line(
    (draft ? "DRAFT — " : "") +
      (kind === "invoice" ? "INVOICE" : "PROJECT PROPOSAL"),
    19,
  );
  paragraph(projectName);
  section(
    "From",
    [seller.name || "Alex Bell Arts", seller.address, seller.email]
      .filter(Boolean)
      .join("\n"),
  );
  section(
    "Prepared for",
    [client.name, client.address, client.contact, client.email]
      .filter(Boolean)
      .join("\n"),
  );
  if (kind === "proposal") {
    const p = record as Proposal;
    line("Proposal revision " + p.revision + " · " + p.status);
    section("Project value", pounds(Number(p.total_pence)) + " GBP");
    const split = splitPayment(Number(p.total_pence));
    paragraph(
      "50% deposit: " +
        pounds(split.deposit) +
        " · Final balance: " +
        pounds(split.final),
    );
    for (const [key, title] of [
      ["scope", "Scope"],
      ["deliverables", "Deliverables"],
      ["timeline", "Timeline"],
      ["revisions", "Revision allowance"],
      ["exclusions", "Outside scope"],
      ["notes", "Additional notes"],
    ] as const)
      section(title, p[key]);
    section(
      "Payment schedule",
      "50% before onboarding and design work; the remaining balance on completion and approval, before final files or website handover.",
    );
    paragraph(
      "Proposal decisions are recorded manually. This PDF is not a signed contract or electronic signature.",
    );
  } else {
    const i = record as Invoice;
    line(
      (i.number || "Number assigned on issue") +
        " · " +
        i.kind +
        " · " +
        i.status,
    );
    section(
      "Invoice details",
      "Issued: " +
        (i.issued_on ?? "Not issued") +
        "\nDue: " +
        (i.due_on ?? "To be confirmed") +
        (i.paid_on ? "\nFull payment recorded: " + i.paid_on : ""),
    );
    section(
      "Description",
      i.kind === "Deposit"
        ? "Initial 50% project payment"
        : "Remaining project balance before final delivery",
    );
    section("Amount due", pounds(Number(i.amount_pence)) + " GBP");
    if (i.status === "Paid") paragraph("Outstanding on this invoice: £0.00");
    if (i.status === "Void") paragraph("VOID — do not pay this invoice.");
    section(
      "Tax",
      seller.tax_note || "Tax treatment must be confirmed before issue.",
    );
    section(
      "Payment instructions",
      seller.payment_instructions ||
        "Payment instructions supplied separately.",
    );
    paragraph(
      "Payments are recorded manually. No online payment is processed by this document.",
    );
  }
  if (draft)
    paragraph(
      "DRAFT — review all details before issuing or sharing. Not a demand for payment.",
    );
  pages.forEach((p, index) =>
    p.drawText("Alex Bell Arts · " + (index + 1) + " / " + pages.length, {
      x: 48,
      y: 30,
      size: 8,
      font,
      color: rgb(0.45, 0.45, 0.45),
    }),
  );
  pdf.setTitle(
    kind === "invoice" ? "Alex Bell Arts invoice" : "Alex Bell Arts proposal",
  );
  pdf.setAuthor("Alex Bell Arts");
  return pdf.save();
}
