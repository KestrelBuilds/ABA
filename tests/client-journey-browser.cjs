// Real Next.js pages/actions in Chromium, with an isolated fictional Supabase HTTP
// fixture. This tests UI integration, not hosted provider security or email delivery.
const { createServer } = require("node:http");
const { spawn } = require("node:child_process");
const { chromium, expect } = require("@playwright/test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fixturePort = 35431,
  appPort = 35432;
const prospectMode = process.argv.includes("--prospect");
const prospectOwnerMode = process.argv.includes("--prospect-owner");
const enquiriesMode = process.argv.includes("--enquiries");
const deletionMode =
  process.argv.includes("--delete-client") ||
  process.argv.includes("--delete-client-retry");
let failDeletionStorage = process.argv.includes("--delete-client-retry");
let clientDeleted = false,
  deletionPending = false;
const templateMode = process.argv
  .find((a) => a.startsWith("--template="))
  ?.split("=")[1];
const contractMode = process.argv.includes("--contracts");
const contractOwnerMode = process.argv.includes("--contract-owner");
const verificationMode = process.argv.includes("--verification");
const managementMode = process.argv.includes("--management");
const stageMode = process.argv.includes("--stages");
const fixtureStageId = randomUUID();
const financeMode = process.argv.includes("--finance");
const ownerMode =
  process.argv.includes("--owner-preview") ||
  financeMode ||
  verificationMode ||
  contractOwnerMode ||
  Boolean(templateMode) ||
  deletionMode ||
  prospectOwnerMode ||
  enquiriesMode;
const uid = randomUUID(),
  cid = randomUUID(),
  pid = randomUUID(),
  presentation = randomUUID(),
  finalDoc = randomUUID();
const user = {
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  email: "fictional@example.com",
  email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: new Date().toISOString(),
};
const jwt = [
  { alg: "HS256", typ: "JWT" },
  {
    sub: uid,
    aud: "authenticated",
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    iss: `http://127.0.0.1:${fixturePort}/auth/v1`,
    aal: "aal1",
  },
  "fixture",
]
  .map((x) =>
    Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString(
      "base64url",
    ),
  )
  .join(".");
const project = {
  id: pid,
  client_id: cid,
  name: "Fictional client journey",
  type: "Brand Identity",
  due: "2027-01-01",
  budget: 1000,
  contract_signed: true,
  deposit_paid: true,
  final_paid: false,
  final_approved: false,
};
if (verificationMode || contractMode || contractOwnerMode) {
  project.contract_signed = false;
  project.deposit_paid = false;
}
if (financeMode) {
  project.deposit_paid = false;
  project.final_paid = false;
}
if (templateMode) {
  project.type =
    templateMode === "website"
      ? "Website Design"
      : templateMode === "combined"
        ? "Both"
        : "Brand Identity";
  project.contract_signed = false;
  project.deposit_paid = false;
}
const liveTemplate = templateMode
  ? [
      ...[
        "Enquiry Stage",
        "Project Proposal",
        "Onboarding",
        "Contract",
        "Invoice",
      ].map((name) => ({ name, stream: "Onboarding" })),
      ...(templateMode !== "website"
        ? [
            "Creative Direction",
            "Logo Design",
            "Logo Presentation",
            "Brand Touchpoints",
            "Brand Guidelines",
          ].map((name) => ({ name, stream: "Brand Identity" }))
        : []),
      ...(templateMode !== "brand"
        ? [
            "Website Brief & Content",
            "Page Structure & Layout",
            "Website Design",
            "Framer Build & Review",
            "Launch & Handover",
          ].map((name) => ({ name, stream: "Website Design" }))
        : []),
      { name: "Goodbye Packet", stream: "Delivery" },
    ].map((s, position) => ({
      ...s,
      id: randomUUID(),
      project_id: pid,
      position,
      status: "Not Started",
      visible: true,
    }))
  : [];
const financeProposals = [];
const financeInvoices = ["Deposit", "Final"].map((kind) => ({
  id: randomUUID(),
  project_id: pid,
  kind,
  number: null,
  amount_pence: 50000,
  status: "Draft",
  issued_on: null,
  due_on: null,
  paid_on: null,
  client_snapshot: null,
  seller_snapshot: null,
}));
if (financeMode) {
  financeInvoices[0].status = "Issued";
  financeInvoices[0].number = "ABA-PREVIOUS-000001";
  financeInvoices[0].client_snapshot = {
    name: "Fictional business",
    address: "Fictional address",
  };
  financeInvoices[0].seller_snapshot = {
    name: "Alex Bell Arts",
    address: "Fictional address",
    email: "owner@example.com",
  };
}
const seller = {
  id: true,
  seller_name: "Alex Bell trading as Alex Bell Arts",
  seller_address: "Fictional seller address",
  seller_email: "owner@example.com",
  payment_instructions: "Payment instructions supplied separately",
  no_vat_confirmed: true,
};
const documents = [
  {
    id: presentation,
    project_id: pid,
    name: "Fictional presentation.pdf",
    object_path: pid + "/" + presentation,
    category: "presentation",
    published: true,
  },
  {
    id: finalDoc,
    project_id: pid,
    name: "Fictional final files.pdf",
    object_path: pid + "/" + finalDoc,
    category: "final",
    published: true,
  },
];
let exchangeEnabled = contractMode;
let uploadedContractPdf = null;
if (contractMode || contractOwnerMode)
  Object.assign(documents[0], {
    name: "Agreement.pdf",
    category: "document",
    document_role: "Contract",
    version_label: "v1",
    stage_id: fixtureStageId,
  });
const remainingDeletionPaths = new Set(documents.map((d) => d.object_path));
const prospective = {
  project_id: pid,
  enabled: prospectMode,
  release_step: "discovery",
  enquiry_status: "new",
  booking_url: "https://calendly.com/alex-bell-arts/new-meeting",
  proposal_stage_id: randomUUID(),
  contract_stage_id: randomUUID(),
  invoice_stage_id: randomUUID(),
};
const potentialStages = [
  { id: prospective.proposal_stage_id, name: "Project Proposal" },
  { id: prospective.contract_stage_id, name: "Contract" },
  { id: prospective.invoice_stage_id, name: "Invoice" },
].map((s, position) => ({
  ...s,
  project_id: pid,
  stream: "Onboarding",
  position,
  status: "Not Started",
  visible: true,
}));
const incoming = [
  {
    id: randomUUID(),
    source: "tally",
    business_name: "Tally enquiry company",
    contact_name: "Taylor",
    email: "tally@example.com",
    status: "new",
    fields: [{ label: "Your goals", value: "A design-focused Framer website" }],
    linked_client_id: null,
    linked_project_id: null,
  },
];
const proposalResponses = [];
if (prospectMode || prospectOwnerMode) {
  project.contract_signed = false;
  project.deposit_paid = false;
  Object.assign(documents[0], {
    name: "Proposal.pdf",
    category: "document",
    document_role: "Proposal",
    version_label: "v1",
    stage_id: prospective.proposal_stage_id,
  });
  documents.push(
    {
      id: randomUUID(),
      project_id: pid,
      name: "Agreement.pdf",
      object_path: pid + "/" + randomUUID(),
      category: "document",
      published: true,
      document_role: "Contract",
      version_label: "v1",
      stage_id: prospective.contract_stage_id,
    },
    {
      id: randomUUID(),
      project_id: pid,
      name: "Deposit.pdf",
      object_path: pid + "/" + randomUUID(),
      category: "document",
      published: true,
      document_role: "Invoice",
      version_label: "v1",
      stage_id: prospective.invoice_stage_id,
    },
  );
}
const prospectDocuments = () =>
  documents.filter(
    (d) =>
      d.published &&
      d.category === "document" &&
      prospective.enabled &&
      prospective.enquiry_status !== "closed" &&
      ((prospective.release_step !== "discovery" &&
        d.document_role === "Proposal" &&
        d.stage_id === prospective.proposal_stage_id) ||
        (prospective.release_step === "agreement" &&
          ((d.document_role === "Contract" &&
            d.stage_id === prospective.contract_stage_id) ||
            (d.document_role === "Invoice" &&
              d.stage_id === prospective.invoice_stage_id)))),
  );
const questionnaires = [],
  feedback = [];
const clientActions = [
  {
    id: randomUUID(),
    project_id: pid,
    title: "Supply approved brand assets",
    due: "2027-01-01",
    status: "To do",
  },
];
const assets = [];
const errors = [];
let browser, app;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${fixturePort}`);
    const path = url.pathname;
    let text = "";
    for await (const chunk of req) text += chunk;
    const body =
      text && (req.headers["content-type"] || "").includes("application/json")
        ? JSON.parse(text)
        : {};
    const json = (data, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    if (path === "/auth/v1/token")
      return json({
        access_token: jwt,
        refresh_token: "fictional-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user,
      });
    if (path === "/auth/v1/user") return json(user);
    if (path === "/auth/v1/logout") return json({});
    if (path.startsWith("/storage/v1/object/sign/")) {
      if (req.method === "POST")
        return json({
          signedURL: path.replace("/storage/v1", "") + "?token=fictional",
        });
      res.writeHead(200, { "Content-Type": "application/pdf" });
      if (path.includes("client-assets/") && uploadedContractPdf)
        return res.end(uploadedContractPdf);
      return res.end("%PDF-1.4\nFictional test bytes\n%%EOF");
    }
    if (
      path.startsWith("/storage/v1/object/client-assets/") &&
      req.method === "POST"
    ) {
      if (contractMode) {
        const pdfStart = text.indexOf("%PDF-");
        const pdfEnd = text.indexOf("%%EOF", pdfStart) + 5;
        if (pdfStart >= 0 && pdfEnd > pdfStart)
          uploadedContractPdf = Buffer.from(text.slice(pdfStart, pdfEnd));
      }
      return json({ Key: path.split("/object/")[1], Id: randomUUID() });
    }
    if (
      deletionMode &&
      path === "/storage/v1/object/project-files" &&
      req.method === "DELETE"
    ) {
      if (failDeletionStorage) {
        failDeletionStorage = false;
        return json({ message: "Fictional storage outage" }, 503);
      }
      for (const prefix of body.prefixes ?? [])
        remainingDeletionPaths.delete(prefix);
      return json([]);
    }
    const table = path.split("/").pop();
    if (table === "prospect_spaces_ready")
      return json(prospectMode || prospectOwnerMode || enquiriesMode);
    if (table === "enquiries_ready") return json(enquiriesMode);
    if (table === "set_prospect_space") {
      Object.assign(prospective, {
        enabled: body.shared,
        release_step: body.step,
        enquiry_status: body.status,
        booking_url: body.booking,
        proposal_stage_id: body.proposal_stage,
        contract_stage_id: body.contract_stage,
        invoice_stage_id: body.invoice_stage,
      });
      return json(null);
    }
    if (table === "prospect_area")
      return json(
        (prospectMode || prospectOwnerMode) &&
          prospective.enabled &&
          prospective.enquiry_status !== "closed"
          ? [
              {
                project_id: pid,
                name: project.name,
                enabled: prospective.enabled,
                release_step: prospective.release_step,
                enquiry_status: prospective.enquiry_status,
                booking_url: prospective.booking_url,
                contract_signed: project.contract_signed,
                deposit_paid: project.deposit_paid,
                documents: prospectDocuments().map(
                  ({ id, name, version_label, document_role }) => ({
                    id,
                    name,
                    version_label,
                    document_role,
                  }),
                ),
                returns: assets.map(
                  ({ id, name, contract_document_id, created_at }) => ({
                    id,
                    name,
                    contract_document_id,
                    created_at,
                  }),
                ),
                responses: proposalResponses.map(
                  ({ document_id, decision, message }) => ({
                    document_id,
                    decision,
                    message,
                  }),
                ),
              },
            ]
          : [],
      );
    if (table === "convert_enquiry") {
      const e = incoming.find((e) => e.id === body.target);
      e.status = "converted";
      e.linked_client_id = cid;
      e.linked_project_id = pid;
      Object.assign(project, {
        name: body.project_name,
        type: body.project_type,
        contract_signed: false,
        deposit_paid: false,
      });
      return json(pid);
    }
    if (table === "client_deletion_ready") return json(deletionMode);
    if (table === "prepare_client_deletion") {
      if (body.target !== cid || body.confirmation !== "Fictional business")
        return json(
          {
            code: "P0001",
            message: "Type the exact client business name to confirm deletion",
          },
          400,
        );
      deletionPending = true;
      return json({
        client_id: cid,
        project_ids: [pid],
        files: [...remainingDeletionPaths].map((path) => ({
          bucket: "project-files",
          path,
        })),
      });
    }
    if (table === "finish_client_deletion") {
      if (!deletionPending || remainingDeletionPaths.size)
        return json({ message: "File cleanup incomplete" }, 400);
      clientDeleted = true;
      return json(null);
    }
    if (table === "contract_area_ready")
      return json(contractMode || contractOwnerMode);
    if (table === "can_read_contract_document")
      return json(exchangeEnabled && body.target === presentation);
    if (table === "contract_area")
      return json(
        (contractMode || contractOwnerMode) && exchangeEnabled
          ? [
              {
                project_id: pid,
                name: project.name,
                stage_id: fixtureStageId,
                stage_name: "Contract and Deposit",
                contract_signed: project.contract_signed,
                deposit_paid: project.deposit_paid,
                documents: [
                  {
                    id: presentation,
                    name: "Agreement.pdf",
                    version_label: "v1",
                  },
                ],
                returns: assets
                  .filter((a) => a.contract_document_id === presentation)
                  .map((a) => ({
                    id: a.id,
                    name: a.name,
                    contract_document_id: a.contract_document_id,
                    created_at: a.created_at,
                  })),
              },
            ]
          : [],
      );
    if (table === "business_documents_ready")
      return json(
        financeMode || stageMode || contractMode || contractOwnerMode,
      );
    if (table === "new_proposal") {
      const id = randomUUID();
      financeProposals.push({
        id,
        project_id: pid,
        revision: financeProposals.length + 1,
        status: "Draft",
        scope: "",
        deliverables: "",
        timeline: "",
        revisions: "",
        exclusions: "",
        notes: "",
        total_pence: 100000,
        client_snapshot: null,
        seller_snapshot: null,
      });
      return json(id);
    }
    if (table === "save_proposal") {
      const p = financeProposals.find((p) => p.id === body.target);
      for (const field of [
        "scope",
        "deliverables",
        "timeline",
        "revisions",
        "exclusions",
        "notes",
      ])
        p[field] = body["new_" + field];
      return json(null);
    }
    if (table === "change_proposal_status") {
      const p = financeProposals.find((p) => p.id === body.target);
      p.status = body.new_status;
      p.client_snapshot = {
        name: "Fictional business",
        contact: "Jamie Example",
        email: user.email,
      };
      p.seller_snapshot = {
        name: seller.seller_name,
        address: seller.seller_address,
        email: seller.seller_email,
      };
      return json(null);
    }
    if (table === "issue_invoice") {
      const i = financeInvoices.find((i) => i.id === body.target);
      i.status = "Issued";
      i.number = "ABA-TEST-000001";
      i.issued_on = body.issue_date;
      i.due_on = body.due_date;
      i.client_snapshot = {
        name: "Fictional business",
        address: "Fictional billing address",
      };
      i.seller_snapshot = {
        name: seller.seller_name,
        address: seller.seller_address,
        email: seller.seller_email,
        tax_note: "No VAT charged",
        payment_instructions: seller.payment_instructions,
      };
      return json(null);
    }
    if (table === "void_invoice") {
      const i = financeInvoices.find((i) => i.id === body.target);
      i.status = "Void";
      return json(null);
    }
    if (table === "record_invoice_payment") {
      const i = financeInvoices.find((i) => i.id === body.target);
      i.status = "Paid";
      i.paid_on = body.payment_date;
      project.deposit_paid = true;
      return json(null);
    }
    if (table === "project_management_ready")
      return json(
        managementMode || stageMode || contractMode || contractOwnerMode,
      );
    if (table === "complete_client_action") {
      const a = clientActions.find((a) => a.id === body.target);
      if (a) a.status = body.done ? "Done" : "To do";
      return json(null);
    }

    let rows = [];
    if (table === "prospect_spaces")
      rows =
        prospectMode || prospectOwnerMode || enquiriesMode ? [prospective] : [];
    if (table === "proposal_responses") {
      if (req.method === "POST")
        proposalResponses.push({
          ...body,
          id: randomUUID(),
          created_at: new Date().toISOString(),
        });
      rows = proposalResponses;
    }
    if (table === "enquiries") rows = incoming;
    if (table === "profiles")
      rows = [
        {
          id: uid,
          role: ownerMode ? "admin" : "client",
          client_id: ownerMode ? null : cid,
        },
      ];
    if (table === "clients")
      rows = clientDeleted
        ? []
        : [
            {
              id: cid,
              name: "Fictional business",
              contact: "Jamie Example",
              email: user.email,
              sector: "Design",
              deletion_pending: deletionPending,
            },
          ];
    if (table === "contract_exchanges") {
      if (req.method === "POST") exchangeEnabled = body.enabled;
      rows = [
        { project_id: pid, stage_id: fixtureStageId, enabled: exchangeEnabled },
      ];
    }
    if (table === "projects") {
      if (req.method === "PATCH") Object.assign(project, body);
      rows = [project];
    }
    if (table === "finance_settings") rows = [seller];
    if (table === "client_billing")
      rows = [
        {
          client_id: cid,
          billing_name: "Fictional business",
          billing_address: "Fictional billing address",
        },
      ];
    if (table === "proposals") rows = financeMode ? financeProposals : [];
    if (table === "invoices") rows = financeMode ? financeInvoices : [];
    if (table === "client_actions") rows = clientActions;
    if (table === "project_details")
      rows = [
        {
          project_id: pid,
          goal: "A clear identity",
          deliverables: "Agreed logo and guidelines",
          exclusions: "Printing",
          approver: "Jamie Example",
          support: "Agreed support only",
        },
      ];
    if (table === "project_handover")
      rows =
        project.final_paid && project.final_approved
          ? [{ project_id: pid, body: "Private final handover guidance" }]
          : [];
    if (table === "client_assets") {
      if (req.method === "POST")
        assets.push({ ...body, created_at: new Date().toISOString() });
      rows = assets;
    }

    if (table === "stage_resources")
      rows = stageMode
        ? [
            {
              stage_id: fixtureStageId,
              instructions: "Book your discovery call and review this PDF.",
              booking_url: "https://calendly.com/alex-bell-arts/new-meeting",
            },
          ]
        : [];
    if (table === "stages")
      rows = [
        {
          id: fixtureStageId,
          project_id: pid,
          name:
            verificationMode || contractOwnerMode || contractMode
              ? "Contract and Deposit"
              : stageMode
                ? "Discovery Call"
                : "Concept review",
          stream:
            verificationMode || contractOwnerMode || contractMode
              ? "Onboarding"
              : "Brand Identity",
          position: 0,
          status: verificationMode ? "Completed" : "Awaiting Client",
          visible: true,
        },
      ];
    if (table === "stages" && templateMode) rows = liveTemplate;
    if (table === "stages" && (prospectMode || prospectOwnerMode))
      rows = potentialStages;
    if (stageMode || verificationMode) documents[0].stage_id = fixtureStageId;
    if (table === "documents")
      rows = documents.filter(
        (d) =>
          d.category !== "final" ||
          (project.final_paid && project.final_approved),
      );
    if (table === "questionnaires") {
      if (req.method === "POST")
        questionnaires.push({
          ...body,
          id: randomUUID(),
          submitted_at: new Date().toISOString(),
        });
      rows = questionnaires;
    }
    if (table === "feedback") {
      if (req.method === "POST")
        feedback.push({
          ...body,
          ...(managementMode
            ? { approver_name: "Jamie Example", reviewed_version: "v1" }
            : {}),
          id: randomUUID(),
          created_at: new Date().toISOString(),
        });
      rows = feedback;
    }
    if (contractMode && !(project.contract_signed && project.deposit_paid)) {
      if (
        [
          "projects",
          "stages",
          "project_details",
          "project_handover",
          "questionnaires",
          "client_actions",
          "stage_resources",
          "feedback",
          "proposals",
          "invoices",
        ].includes(table)
      )
        rows = [];
      if (table === "documents")
        rows = documents.filter(
          (d) => d.id === presentation && exchangeEnabled,
        );
    }
    if (
      clientDeleted &&
      [
        "projects",
        "stages",
        "documents",
        "feedback",
        "questionnaires",
        "project_notes",
        "client_assets",
      ].includes(table)
    )
      rows = [];
    if (prospectMode && !(project.contract_signed && project.deposit_paid)) {
      if (
        [
          "projects",
          "stages",
          "project_details",
          "project_handover",
          "client_actions",
          "questionnaires",
          "feedback",
          "stage_resources",
          "invoices",
          "proposals",
        ].includes(table)
      )
        rows = [];
      if (table === "documents") rows = prospectDocuments();
    }
    for (const [key, value] of url.searchParams)
      if (value.startsWith("eq."))
        rows = rows.filter((r) => String(r[key]) === value.slice(3));
    if ((req.headers.accept || "").includes("vnd.pgrst.object+json"))
      return json(rows[0] ?? null);
    return json(rows, req.method === "POST" ? 201 : 200);
  } catch (e) {
    errors.push(e.message);
    res.writeHead(500);
    res.end("{}");
  }
});
(async () => {
  await new Promise((resolve) =>
    server.listen(fixturePort, "127.0.0.1", resolve),
  );
  try {
    app = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(appPort),
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixturePort}`,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fictional-public-key",
          SUPABASE_SERVICE_ROLE_KEY: "",
          APP_ORIGIN: `http://127.0.0.1:${appPort}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let logs = "";
    app.stdout.on("data", (b) => (logs += b));
    app.stderr.on("data", (b) => (logs += b));
    for (let i = 0; i < 80; i++) {
      if (app.exitCode !== null) throw Error(logs);
      try {
        const r = await fetch(`http://127.0.0.1:${appPort}/login`);
        if (r.ok) break;
      } catch {}
      if (i === 79) throw Error("Fixture app did not start: " + logs);
      await new Promise((r) => setTimeout(r, 250));
    }
    browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    page.on("pageerror", (e) => errors.push(e.message));
    const captureUi = async (name, target = page) => {
      for (const width of [390, 1440, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          )
          .toBe(true);
        await target.screenshot({
          path: `/tmp/aba-ui-${name}-${width}.png`,
          ...(target === page ? { fullPage: true } : {}),
        });
      }
      await page.setViewportSize({ width: 390, height: 844 });
    };

    await page.goto(`http://127.0.0.1:${appPort}/login`);
    await page
      .getByLabel("Email address", { exact: true })
      .first()
      .fill(user.email);
    await page
      .getByLabel("Password", { exact: true })
      .fill("Fictional-password-123");
    await page
      .getByRole("button", { name: "Sign in to ABA Studio", exact: true })
      .click();
    if (prospectMode) {
      await page.waitForURL("**/welcome");
      await page
        .getByRole("heading", {
          name: "Let’s explore your project",
          exact: true,
        })
        .waitFor();
      await page.getByRole("link", { name: "Book a discovery call" }).waitFor();
      assert.equal(
        await page
          .getByRole("heading", { name: "Your project journey", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page.getByRole("link", { name: /Download/ }).count(),
        0,
      );
      await captureUi("discovery");
      prospective.release_step = "proposal";
      await page.reload();
      await page.getByRole("link", { name: "Download proposal" }).waitFor();
      assert.equal(
        await page.getByRole("link", { name: "Download contract" }).count(),
        0,
      );
      await captureUi("proposal");
      await page
        .getByLabel("Message", { exact: true })
        .fill("I would like to proceed after our call");
      await page
        .getByRole("button", { name: "Send my proposal response" })
        .click();
      await page
        .getByText(/Your proposal response has been sent to me/)
        .waitFor();
      assert.equal(proposalResponses.length, 1);
      assert.equal(project.contract_signed, false);
      assert.equal(project.deposit_paid, false);
      prospective.release_step = "agreement";
      await page.reload();
      await page.getByRole("link", { name: "Download contract" }).waitFor();
      await page.getByRole("link", { name: "Download invoice" }).waitFor();
      assert.equal(
        await page
          .getByRole("heading", { name: "Your project journey", exact: true })
          .count(),
        0,
      );
      await captureUi("agreement");
      prospective.enquiry_status = "closed";
      await page.goto(`http://127.0.0.1:${appPort}/welcome`);
      await page
        .getByText(
          "No enquiries are currently shared with this account. Please contact me if you expected an invitation.",
        )
        .waitFor();
      assert.equal(
        await page.getByRole("link", { name: /Download/ }).count(),
        0,
      );
      prospective.enquiry_status = "considering";
      project.contract_signed = true;
      project.deposit_paid = true;
      await page.goto(`http://127.0.0.1:${appPort}/portal`);
      await page
        .getByRole("heading", { name: "Your project journey", exact: true })
        .waitFor();
      assert.deepEqual(errors, []);
      console.log(
        "PASS: potential client sees booking, then only released proposal/agreement PDFs; proposal interest does not verify contract/payment, closed enquiries stop sharing, both gates unlock full journey. Fictional services only.",
      );
      return;
    }
    if (prospectOwnerMode) {
      await page
        .getByRole("heading", { name: "ABA Owner Dashboard", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      const management = page.locator("details.panel").filter({
        has: page.getByText(
          "Potential client · discovery, proposal & onboarding",
          { exact: true },
        ),
      });
      await captureUi("owner-sharing", management);
      await management
        .getByLabel(
          "Allow this client’s invited account into the potential-client area",
        )
        .check();
      await management
        .getByRole("button", { name: "Save potential-client area" })
        .click();
      await management
        .getByText(/Enquiry status and client step saved/)
        .waitFor();
      await expect(
        management.getByRole("button", { name: "Save potential-client area" }),
      ).toBeEnabled();
      await page.getByRole("button", { name: /Preview client portal/ }).click();
      await page
        .getByRole("heading", {
          name: "Let’s explore your project",
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page
          .getByRole("heading", { name: "Your project journey", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Send my proposal response" })
          .count(),
        0,
      );
      assert.equal(
        await page.getByRole("link", { name: /Download/ }).count(),
        0,
      );
      await page
        .getByRole("button", { name: "Back to owner workspace" })
        .click();
      await management
        .getByLabel(
          "Allow this client’s invited account into the potential-client area",
        )
        .check();
      await management
        .getByLabel("What the potential client can see")
        .selectOption("proposal");
      await management
        .getByRole("button", { name: "Save potential-client area" })
        .click();
      await expect.poll(() => prospective.release_step).toBe("proposal");
      await expect(
        management.getByRole("button", { name: "Save potential-client area" }),
      ).toBeEnabled();
      await page.getByRole("button", { name: /Preview client portal/ }).click();
      await page.getByRole("link", { name: "Download proposal" }).waitFor();
      assert.equal(
        await page.getByRole("link", { name: "Download contract" }).count(),
        0,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.deepEqual(errors, []);
      console.log(
        "PASS: owner enables/release-controls prospective view and preview matches limited client screens instead of planned full journey. Fictional services only.",
      );
      return;
    }
    if (enquiriesMode) {
      await page
        .getByRole("heading", { name: "ABA Owner Dashboard", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Enquiries", exact: true })
        .click();
      await page
        .locator(".enquiry-card > summary")
        .filter({ hasText: "Tally enquiry company" })
        .click();
      await page.getByText(/View enquiry answers/).click();
      await page
        .getByText("A design-focused Framer website", { exact: true })
        .waitFor();
      await page
        .getByText("Create a potential project", { exact: true })
        .click();
      await captureUi("enquiries", page.locator(".enquiries-panel"));
      const form = page.locator("form").filter({
        has: page.getByRole("button", {
          name: "Create potential project",
          exact: true,
        }),
      });
      await form
        .getByLabel("Project name", { exact: true })
        .fill("Fictional potential site");
      await form
        .getByLabel("Estimated completion", { exact: true })
        .fill("2027-01-01");
      await form
        .getByRole("button", {
          name: "Create potential project",
          exact: true,
        })
        .click();
      await page.getByText(/Potential project created/).waitFor();
      assert.equal(incoming[0].status, "converted");
      assert.equal(project.contract_signed, false);
      assert.equal(prospective.enabled, false);
      assert.deepEqual(errors, []);
      console.log(
        "PASS: owner reviews a Tally enquiry and explicitly converts it into a potential project; no invitation is sent. Fictional services only.",
      );
      return;
    }
    if (deletionMode) {
      await page
        .getByRole("heading", { name: "ABA Owner Dashboard", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Clients", exact: true }).click();
      const card = page.locator(".client-card").filter({
        has: page.getByRole("heading", {
          name: "Fictional business",
          exact: true,
        }),
      });
      await card
        .getByText("Delete client permanently", { exact: true })
        .click();
      const confirm = card.getByLabel(
        "Type the exact business name to confirm",
      );
      await confirm.fill("Wrong client");
      await card
        .getByRole("checkbox", {
          name: /I understand this permanently removes/,
        })
        .check();
      await card
        .getByRole("button", { name: "Permanently delete client", exact: true })
        .click();
      await card
        .getByRole("alert")
        .filter({ hasText: "Type the exact client business name" })
        .waitFor();
      assert.equal(deletionPending, false);
      assert.equal(clientDeleted, false);
      const retryMode = failDeletionStorage;
      await confirm.fill("Fictional business");
      await card
        .getByRole("checkbox", {
          name: /I understand this permanently removes/,
        })
        .check();
      await card
        .getByRole("button", { name: "Permanently delete client", exact: true })
        .click();
      if (retryMode) {
        await card
          .getByRole("alert")
          .filter({ hasText: "Deletion paused during private file cleanup" })
          .waitFor();
        assert.equal(clientDeleted, false);
        assert.equal(deletionPending, true);
        assert.ok(remainingDeletionPaths.size > 0);
        await confirm.fill("Fictional business");
        await card
          .getByRole("checkbox", {
            name: /I understand this permanently removes/,
          })
          .check();
        await card
          .getByRole("button", { name: "Retry client deletion", exact: true })
          .click();
      }
      await page
        .getByRole("status")
        .filter({
          hasText: "Client, linked projects and private uploads deleted",
        })
        .waitFor();
      await card.waitFor({ state: "detached" });
      assert.equal(clientDeleted, true);
      assert.equal(remainingDeletionPaths.size, 0);
      assert.equal(await card.count(), 0);
      assert.deepEqual(errors, []);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      console.log(
        "PASS: exact-name client deletion confirmation, private file cleanup and record removal" +
          (retryMode ? ", storage failure pauses and retry succeeds" : "") +
          ". Fictional services only.",
      );
      return;
    }
    if (templateMode) {
      await page
        .getByRole("heading", { name: "ABA Owner Dashboard", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      assert.equal(
        await page.locator(".milestone-disclosure").count(),
        templateMode === "combined" ? 16 : 11,
      );
      const findStage = (name) =>
        page.locator(".milestone-disclosure").filter({
          has: page.locator('input[name="name"][value="' + name + '"]'),
        });
      const onboarding = findStage("Onboarding");
      await onboarding.locator("summary").first().click();
      assert.equal(
        await onboarding
          .getByRole("link", { name: /Open brand discovery/ })
          .count(),
        templateMode === "website" ? 0 : 1,
      );
      assert.equal(
        await onboarding
          .getByRole("link", { name: /Open website discovery/ })
          .count(),
        templateMode === "brand" ? 0 : 1,
      );
      const enquiry = findStage("Enquiry Stage");
      await enquiry.locator("summary").first().click();
      await enquiry
        .getByRole("link", { name: /Book a call with me/ })
        .waitFor();
      for (const [name, field] of [
        ["Contract", "contract_signed"],
        ["Invoice", "deposit_paid"],
      ]) {
        const stage = findStage(name);
        await stage.locator("summary").first().click();
        assert.equal(
          await stage
            .locator('.journey-verification input[name="field"]')
            .count(),
          1,
        );
        assert.equal(
          await stage
            .locator('.journey-verification input[name="field"]')
            .inputValue(),
          field,
        );
        assert.equal(
          await stage.locator('select[name="status"]').isDisabled(),
          true,
        );
      }
      const goodbye = findStage("Goodbye Packet");
      await goodbye.locator("summary").first().click();
      assert.equal(
        await goodbye
          .getByRole("link", { name: /goodbye.*questionnaire/i })
          .count(),
        0,
      );
      project.final_paid = true;
      project.final_approved = true;
      await page.reload();
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      await goodbye.locator("summary").first().click();
      await goodbye
        .getByRole("link", { name: /goodbye.*questionnaire/i })
        .waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.deepEqual(errors, []);
      console.log(
        "PASS: " +
          templateMode +
          " live template layout, matching brief/booking links, distinct contract/deposit confirmations and gated goodbye, at mobile size. Fictional services only.",
      );
      return;
    }
    if (contractMode) {
      await page.waitForURL("**/contracts");
      await page
        .getByRole("heading", { name: "Your contract with me", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("heading", { name: "Your project journey", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByText("Fictional final files.pdf", { exact: true })
          .count(),
        0,
      );
      const download = await page.request.get(
        new URL(
          await page
            .getByRole("link", { name: /Download contract PDF/ })
            .getAttribute("href"),
          page.url(),
        ).href,
      );
      assert.equal(download.status(), 200);
      await page.getByLabel("Signed or completed PDF").setInputFiles({
        name: "Invalid.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("This is not a PDF"),
      });
      await page
        .getByRole("button", { name: "Send signed PDF for review" })
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Choose a completed PDF up to 3 MB." })
        .waitFor();
      assert.equal(assets.length, 0);
      const bytes = Buffer.from(
        "%PDF-1.4\nFictional Acrobat completed contract; keep signed bytes unchanged\n%%EOF",
      );
      await page.getByLabel("Signed or completed PDF").setInputFiles({
        name: "Signed agreement.pdf",
        mimeType: "application/pdf",
        buffer: bytes,
      });
      await page
        .getByRole("button", { name: "Send signed PDF for review" })
        .click();
      await page
        .getByText(/Your completed PDF has been sent for my review/)
        .waitFor();
      const returned = page.getByRole("link", {
        name: /Your returned copy.*Signed agreement.pdf/,
      });
      await returned.waitFor();
      assert.equal(assets[0].contract_document_id, presentation);
      assert.deepEqual(uploadedContractPdf, bytes);
      const returnedBytes = await page.request.get(
        new URL(await returned.getAttribute("href"), page.url()).href,
      );
      assert.deepEqual(await returnedBytes.body(), bytes);
      assert.equal(project.contract_signed, false);
      assert.equal(project.deposit_paid, false);
      project.contract_signed = true;
      await page.goto(`http://127.0.0.1:${appPort}/portal`);
      await page.waitForURL("**/contracts");
      project.deposit_paid = true;
      await page.goto(`http://127.0.0.1:${appPort}/portal`);
      await page
        .getByRole("heading", { name: project.name, exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("heading", { name: "Your contract with me", exact: true })
          .count(),
        0,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.deepEqual(errors, []);
      console.log(
        "PASS: restricted client contract download, byte-identical signed PDF return, no auto-verification, signed-only remains restricted, contract plus deposit opens full portal. Fictional services only.",
      );
      return;
    }
    if (contractOwnerMode) {
      await page
        .getByRole("heading", { name: "ABA Owner Dashboard", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      const stage = page
        .locator(".milestone-disclosure")
        .filter({ hasText: "Contract and Deposit" });
      await stage.locator("summary").first().click();
      await stage.getByText("Initial contract area", { exact: true }).click();
      await stage.locator('input[type="checkbox"][name="confirmed"]').check();
      await stage
        .getByRole("button", {
          name: "Enable initial contract area",
          exact: true,
        })
        .click();
      const preview = stage.getByRole("link", {
        name: /Preview initial contract area/,
      });
      await preview.waitFor();
      assert.equal(exchangeEnabled, true);
      assert.match(
        await stage.locator(".file-visibility").first().innerText(),
        /initial contract area only/,
      );
      await preview.click();
      await page
        .getByText(/Read-only preview of the initial contract area/)
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Send signed PDF for review" })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Sign out", exact: true })
          .count(),
        0,
      );
      assert.equal(assets.length, 0);
      assert.equal(project.contract_signed, false);
      assert.equal(project.deposit_paid, false);
      assert.deepEqual(errors, []);
      console.log(
        "PASS: owner opts in a specific contract stage and previews the restricted area without client upload/actions or verification changes. Fictional services only.",
      );
      return;
    }
    if (verificationMode) {
      await page
        .getByRole("heading", { name: "ABA Owner Dashboard", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      const stage = page
        .locator(".milestone-disclosure")
        .filter({ hasText: "Contract and Deposit" });
      assert.equal(
        await page
          .getByRole("button", { name: "Finance", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByText("Previous generated documents", { exact: true })
          .count(),
        0,
      );
      const focus = page.getByRole("region", { name: "Project at a glance" });
      await focus.getByRole("link", { name: "Open next step" }).click();
      assert.equal(await stage.evaluate((el) => el.open), true);
      assert.match(
        await focus.innerText(),
        /Locked — needs signed contract and deposit payment/,
      );

      assert.match(
        await stage.locator("summary").first().innerText(),
        /Awaiting verification/,
      );
      const stageSettings = stage.locator("details").filter({
        has: page
          .locator("summary")
          .filter({ hasText: /^Edit stage settings$/ }),
      });
      await stageSettings.locator("summary").first().click();
      assert.equal(
        await stage.locator('select[name="status"]').isDisabled(),
        true,
      );
      await stageSettings.locator("summary").first().click();
      const stageFile = stage.locator(".file-visibility").first();
      const libraryFile = page
        .locator(".document-item .file-visibility")
        .first();
      assert.match(
        await stageFile.innerText(),
        /verify the signed contract; verify the deposit payment/,
      );
      assert.equal(await stageFile.innerText(), await libraryFile.innerText());
      await captureUi("verification", stage);
      const confirmations = stage.locator(".journey-verification form");
      await confirmations.nth(0).getByRole("checkbox").check();
      await confirmations
        .nth(0)
        .getByRole("button", { name: "Verify signed contract" })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector(".milestone-disclosure summary")
          ?.textContent.includes("In Progress"),
      );
      assert.equal(project.contract_signed, true);
      assert.equal(project.deposit_paid, false);
      await confirmations.nth(1).getByRole("checkbox").check();
      await confirmations
        .nth(1)
        .getByRole("button", { name: "Verify 50% deposit" })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector(".milestone-disclosure summary")
          ?.textContent.includes("Completed"),
      );
      assert.equal(project.deposit_paid, true);
      assert.match(await focus.innerText(), /Eligible for client access/);
      assert.equal(
        await confirmations.nth(1).getByRole("checkbox").isChecked(),
        false,
      );
      assert.match(await stageFile.innerText(), /Available to this project/);
      assert.equal(await stageFile.innerText(), await libraryFile.innerText());
      await confirmations.nth(1).getByRole("checkbox").check();
      await confirmations
        .nth(1)
        .getByRole("button", { name: "Remove verification" })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector(".milestone-disclosure summary")
          ?.textContent.includes("In Progress"),
      );
      assert.equal(project.deposit_paid, false);
      assert.match(await stageFile.innerText(), /verify the deposit payment/);
      assert.equal(await stageFile.innerText(), await libraryFile.innerText());
      assert.equal(
        await page
          .locator("#controls")
          .locator("..")
          .locator('input[name="deposit_paid"]')
          .count(),
        0,
      );
      await page
        .getByRole("heading", { name: "All project files", exact: true })
        .waitFor();
      assert.deepEqual(errors, []);
      console.log(
        "PASS: contradictory completed stage requires explicit contract and deposit verification; independent updates complete the stage, revocation restores restrictions; summary has no duplicate checkbox. Fictional services only.",
      );
      return;
    }
    if (financeMode) {
      await page
        .getByRole("heading", { name: "ABA Owner Dashboard", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Finance", exact: true })
          .count(),
        0,
      );
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      await page
        .getByRole("link", { name: "View existing invoice records" })
        .click();
      const history = page.getByRole("region", {
        name: "Previous generated documents",
      });
      assert.equal(
        await history.evaluate((el) => el.closest("details").open),
        true,
      );
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "existing-invoices",
      );
      for (const name of [
        /Create draft proposal/,
        /Create invoice/,
        /Issue invoice/,
        /Save seller/,
        /Save template/,
      ])
        assert.equal(await page.getByRole("button", { name }).count(), 0);
      const invoice = history
        .locator(".business-record")
        .filter({ hasText: "Deposit invoice" });
      const pdf = await page.request.get(
        new URL(
          await invoice
            .getByRole("link", { name: /Download previous invoice PDF/ })
            .getAttribute("href"),
          page.url(),
        ).href,
      );
      assert.equal(pdf.status(), 200);
      assert.ok((await pdf.body()).subarray(0, 4).equals(Buffer.from("%PDF")));
      await invoice.locator('input[name="confirmed"]').check();
      await invoice
        .getByRole("button", { name: "Record full payment", exact: true })
        .click();
      await invoice.getByText("Paid · £500.00", { exact: true }).waitFor();
      assert.equal(financeInvoices[0].status, "Paid");
      assert.equal(project.deposit_paid, true);
      const draft = history
        .locator(".business-record")
        .filter({ hasText: "Final invoice" });
      await draft.getByText("Void unused invoice", { exact: true }).click();
      await draft
        .getByRole("button", { name: "Confirm void", exact: true })
        .click();
      await draft.getByText("Void · £500.00", { exact: true }).waitFor();
      assert.equal(financeInvoices[1].status, "Void");
      assert.deepEqual(errors, []);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      console.log(
        "PASS: generation/Finance controls removed; existing invoice downloads, verified full payments and voiding remain available without new record creation. Fictional services only.",
      );
      return;
    }
    if (ownerMode) {
      await page
        .getByRole("heading", { name: "ABA Owner Dashboard", exact: true })
        .waitFor();
      await page.getByRole("button", { name: /Preview client portal/ }).click();
      await page
        .getByRole("heading", {
          name: "Everything for your project",
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Sign out", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page.getByRole("region", { name: "Project at a glance" }).count(),
        0,
      );
      const brief = page.locator(".questionnaire").first();
      await brief.locator("summary").click();
      assert.equal(
        await brief
          .getByRole("button", { name: "Send my answers" })
          .isDisabled(),
        true,
      );
      assert.equal(
        await page
          .getByRole("heading", { name: "Project controls", exact: true })
          .count(),
        0,
      );
      await page
        .getByRole("button", { name: "Back to owner workspace" })
        .click();
      await page
        .getByRole("heading", { name: "ABA Owner Dashboard", exact: true })
        .waitFor();
      assert.equal(questionnaires.length, 0);
      assert.equal(feedback.length, 0);
      assert.deepEqual(errors, []);
      console.log(
        "PASS: owner opens the real read-only client layout, sees Notion sections, cannot submit client forms or sign out from preview, and returns to owner workspace without mutations. Fictional service fixture used.",
      );
      return;
    }
    await page
      .getByRole("heading", { name: "Fictional client journey", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByText("Fictional final files.pdf", { exact: true })
        .count(),
      0,
    );
    if (stageMode) {
      const stage = page.locator("details.portal-stage-detail").first();
      await stage.locator("summary").first().click();
      assert.equal(
        await stage
          .getByRole("link", { name: "Book a call with me" })
          .getAttribute("href"),
        "https://calendly.com/alex-bell-arts/new-meeting",
      );
      await stage
        .getByRole("link", { name: /Fictional presentation.pdf/ })
        .waitFor();
      await stage
        .getByText("Return a completed PDF or upload a file", { exact: true })
        .click();
      await stage.getByLabel("File", { exact: true }).setInputFiles({
        name: "Fictional signed copy.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 Fictional return"),
      });
      await stage
        .getByRole("button", { name: "Upload my file to this stage" })
        .click();
      await stage
        .getByRole("link", {
          name: /Returned client file.*Fictional signed copy.pdf/,
        })
        .waitFor();
      assert.equal(assets[0].stage_id, fixtureStageId);
      console.log(
        "PASS: detailed stage disclosure, public Calendly booking link, stage-attached PDF and returned client PDF in actual UI with fictional services.",
      );
    }
    if (managementMode) {
      await page
        .getByRole("button", { name: "Mark done", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Mark to do", exact: true })
        .waitFor();
      assert.equal(clientActions[0].status, "Done");
      await page
        .locator("#client-assets")
        .getByLabel("File", { exact: true })
        .setInputFiles({
          name: "Fictional brand asset.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4 Fictional asset"),
        });
      await page
        .getByRole("button", { name: "Upload asset privately", exact: true })
        .click();
      await page
        .getByRole("link", { name: /Fictional brand asset.pdf/ })
        .waitFor();
      assert.equal(assets.length, 1);
      assert.equal(
        await page
          .getByText("Private final handover guidance", { exact: true })
          .count(),
        0,
      );
    }
    await page
      .getByRole("img", { name: "ABA — Alex Bell Arts", exact: true })
      .waitFor();
    const brandImage = await page.request.get(
      `http://127.0.0.1:${appPort}/brand/aba-wordmark.png`,
    );
    assert.equal(brandImage.status(), 200);
    assert.match(brandImage.headers()["content-type"], /image\/png/);
    const discovery = page.locator(".questionnaire").first();
    await discovery.locator("summary").click();
    for (const textarea of await discovery.locator("textarea").all())
      await textarea.fill("A fictional answer for the browser test.");
    await discovery.getByRole("button", { name: "Send my answers" }).click();
    await discovery
      .locator("summary")
      .filter({ hasText: "Submitted" })
      .waitFor();
    assert.equal(questionnaires.length, 1);
    const doc = page
      .locator(".document-item")
      .filter({ hasText: "Fictional presentation.pdf" });
    for (const decision of ["changes_requested", "approved"]) {
      await doc.getByLabel("My response").selectOption(decision);
      await doc
        .getByLabel("Feedback", { exact: true })
        .fill(
          decision === "approved"
            ? "I approve the fictional concept."
            : "Please refine the fictional wordmark.",
        );
      await doc
        .getByRole("button", { name: "Send feedback", exact: true })
        .click();
      await doc
        .getByText(
          decision === "approved"
            ? "I approve the fictional concept."
            : "Please refine the fictional wordmark.",
          { exact: true },
        )
        .waitFor();
    }
    assert.deepEqual(
      feedback.map((f) => f.decision),
      ["changes_requested", "approved"],
    );
    assert.equal(project.final_paid, false);
    assert.equal(
      await page
        .getByText("Fictional final files.pdf", { exact: true })
        .count(),
      0,
    );
    project.final_paid = true;
    await page.reload();
    await page
      .getByRole("heading", { name: "Fictional client journey", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByText("Fictional final files.pdf", { exact: true })
        .count(),
      0,
    );
    project.final_approved = true;
    await page.reload();
    await page
      .getByText("Fictional final files.pdf", { exact: true })
      .waitFor();
    const link = page
      .locator(".document-item")
      .filter({ hasText: "Fictional final files.pdf" })
      .getByRole("link", { name: "Download securely" });
    const download = await page.request.get(
      new URL(await link.getAttribute("href"), page.url()).href,
    );
    assert.equal(download.status(), 200);
    assert.match(await download.text(), /%PDF/);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: "/tmp/aba-client-journey.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    if (managementMode)
      console.log(
        "PASS: dated action completion, private client asset upload, gated handover details and supplied Alex Bell Arts logo rendered through actual app screens with fictional services.",
      );
    console.log(
      "PASS: actual client UI login, questionnaire submission, revision request, creative approval, payment-only lock, final release/download and mobile layout. Supabase HTTP fixture used; this does not verify hosted email/invitation delivery or replace hosted RLS checks.",
    );
  } finally {
    if (browser) await browser.close();
    if (app) {
      app.kill("SIGTERM");
      await new Promise((resolve) => {
        if (app.exitCode !== null) return resolve();
        app.once("exit", resolve);
        setTimeout(() => {
          app.kill("SIGKILL");
          resolve();
        }, 3000).unref();
      });
    }
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
