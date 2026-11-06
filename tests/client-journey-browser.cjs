// Real Next.js pages/actions in Chromium, with an isolated fictional Supabase HTTP
// fixture. This tests UI integration, not hosted provider security or email delivery.
const { createServer } = require("node:http");
const { spawn } = require("node:child_process");
const { chromium, expect } = require("@playwright/test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fixturePort = 35431,
  appPort = 35432;
const projectFinderMode = process.argv.includes("--project-finder");
const reviewDatesMode = process.argv.includes("--review-dates");
const deadlinesMode = process.argv.includes("--deadlines") || reviewDatesMode;
const reviewDateWrites = [];
let reviewDateOwner = true,
  reviewDatesReady = true,
  failReviewDateSave = false;
const deadlineClock = new Date();
const deadlineToday = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(deadlineClock);
const deadlineDate = (offset) =>
  new Date(Date.parse(deadlineToday + "T12:00:00Z") + offset * 86400000)
    .toISOString()
    .slice(0, 10);
let finderWrites = 0,
  finderCreationRequests = 0,
  createdFinderProjectId = "";
const finderExtraStages = [];
const finderClientId = randomUUID(),
  websiteProjectId = randomUUID(),
  combinedFinderId = randomUUID(),
  archivedFinderId = randomUUID();
const portalChecksMode = process.argv.includes("--portal-checks");
const diagnosticCleanupScopes = [];
let diagnosticAccountAttempts = 0;
const secureUnconfiguredMode = process.argv.includes("--secure-unconfigured");
const secureMode =
  process.argv.includes("--secure-uploads") || secureUnconfiguredMode;
const lifecycleMode = process.argv.includes("--lifecycle");
const dashboardMode = process.argv.includes("--dashboard");
const insightsMode = process.argv.includes("--insights") || dashboardMode;
const fileLibraryMode =
  process.argv.includes("--file-library") ||
  process.argv.includes("--file-library-client");
const fileLibraryClient = process.argv.includes("--file-library-client");
const workspaceHelpMode = process.argv.includes("--workspace-help");
const goodbyeStageId = randomUUID();
const invitationsMode = process.argv.includes("--invitations");
const accountMode = process.argv.includes("--account");
const accessHelpMode = process.argv.includes("--access-help");
let accessHelpConnected = false,
  accessPrivateReads = 0;
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
const purposesMode = process.argv.includes("--stage-purposes");
const verificationMode =
  process.argv.includes("--verification") || purposesMode;
let stageName = "Contract and Deposit",
  stagePurpose = "contract_deposit";
const managementMode = process.argv.includes("--management");
const stageMode = process.argv.includes("--stages");
const fixtureStageId = randomUUID();
const financeMode = process.argv.includes("--finance");
const ownerMode =
  process.argv.includes("--owner-preview") ||
  projectFinderMode ||
  deadlinesMode ||
  portalChecksMode ||
  secureMode ||
  lifecycleMode ||
  insightsMode ||
  financeMode ||
  verificationMode ||
  contractOwnerMode ||
  Boolean(templateMode) ||
  deletionMode ||
  prospectOwnerMode ||
  enquiriesMode ||
  invitationsMode ||
  workspaceHelpMode ||
  (fileLibraryMode && !fileLibraryClient);
const uid = randomUUID(),
  cid = randomUUID(),
  pid = randomUUID(),
  presentation = randomUUID(),
  finalDoc = randomUUID();
const inviteeUid = randomUUID();
let invitationAccount = null,
  portalState = "not_invited",
  generatedInvitations = 0;
let portalInvitedAt = null,
  portalExpiresAt = null,
  invitationRevision = 0;
const passwordUpdates = [],
  recoveryRequests = [],
  otpRequests = [],
  verifiedTypes = [];
const user = {
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  email: accessHelpMode
    ? "different-account@example.com"
    : "fictional@example.com",
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
const finderProjects = [
  project,
  {
    ...project,
    id: websiteProjectId,
    client_id: finderClientId,
    name: "Framer website",
    type: "Website Design",
    due: "2026-12-01",
  },
  {
    ...project,
    id: combinedFinderId,
    client_id: finderClientId,
    name: "Brand and website",
    type: "Both",
    due: "2027-02-01",
    separate_approvals: true,
  },
  {
    ...project,
    id: archivedFinderId,
    name: "Archived identity",
    due: "2026-11-01",
    archived_at: "2026-10-30T00:00:00Z",
    archived_client_access: "suspend",
  },
];
const dashboardMonth = (offset) => {
  const date = new Date(deadlineToday.slice(0, 7) + "-01T12:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
};
if (insightsMode) project.due = dashboardMonth(0);
if (dashboardMode) {
  Object.assign(finderProjects[1], {
    due: dashboardMonth(1),
    budget: 2400,
    deposit_paid: false,
  });
  Object.assign(finderProjects[2], { due: dashboardMonth(2), budget: 3000 });
  for (const [name, offset, budget, paid] of [
    ["Packaging design", 3, 1250.01, false],
    ["Motion assets", 4, 4000, true],
    ["Future identity", 8, 7000, false],
  ]) {
    const id = randomUUID();
    finderProjects.push({
      ...project,
      id,
      name,
      due: dashboardMonth(offset),
      budget,
      final_paid: paid,
    });
    finderExtraStages.push(
      ...["Research", "Design", "Review"].map((name, position) => ({
        id: randomUUID(),
        project_id: id,
        name,
        stream: "Brand Identity",
        position,
        status: paid || position === 0 ? "Completed" : "In Progress",
        visible: true,
      })),
    );
  }
  finderExtraStages.push(
    {
      id: randomUUID(),
      project_id: websiteProjectId,
      name: "Wireframes",
      stream: "Website Design",
      position: 0,
      status: "Completed",
      visible: true,
    },
    {
      id: randomUUID(),
      project_id: websiteProjectId,
      name: "Framer build",
      stream: "Website Design",
      position: 1,
      status: "In Progress",
      visible: true,
    },
  );
}
const intakes = [],
  storedUploads = new Map();
let scannerOutage = false,
  scannerInfected = false,
  scanRequests = 0;
const verificationHistory = [],
  streamApprovals = [];
if (lifecycleMode)
  Object.assign(project, {
    type: "Both",
    archived_at: null,
    archived_client_access: "retain",
    separate_approvals: false,
    final_approved: true,
  });
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
if (deadlinesMode) {
  project.due = deadlineDate(0);
  finderProjects[1].due = deadlineDate(12);
  Object.assign(finderProjects[2], {
    due: deadlineDate(3),
    contract_signed: false,
    deposit_paid: false,
  });
  finderProjects[3].due = deadlineDate(-5);
  Object.assign(documents[0], {
    stage_id: fixtureStageId,
    review_due: deadlineDate(2),
    version_label: "v2",
  });
  clientActions[0].due = deadlineDate(1);
  clientActions.push(
    {
      id: randomUUID(),
      project_id: pid,
      title: "Overdue content checklist",
      due: deadlineDate(-2),
      status: "To do",
    },
    {
      id: randomUUID(),
      project_id: pid,
      title: "Finished task",
      due: deadlineDate(0),
      status: "Done",
    },
    ...[35, 36, 37].map((days) => ({
      id: randomUUID(),
      project_id: pid,
      title: "Later action " + days,
      due: deadlineDate(days),
      status: "To do",
    })),
  );
}
if (workspaceHelpMode) {
  project.contract_signed = false;
  project.deposit_paid = false;
  prospective.enabled = true;
  prospective.release_step = "discovery";
  documents[0].document_role = "Contract";
  documents[0].stage_id = fixtureStageId;
  assets.push({
    id: randomUUID(),
    project_id: pid,
    stage_id: fixtureStageId,
    contract_document_id: documents[0].id,
    name: "Returned contract.pdf",
    created_at: new Date().toISOString(),
  });
  clientActions[0].due = "2000-01-01";
  documents[1].stage_id = goodbyeStageId;
  documents.push({
    id: randomUUID(),
    project_id: pid,
    stage_id: goodbyeStageId,
    name: "Goodbye draft.pdf",
    category: "document",
    document_role: "Handover",
    published: false,
  });
}
if (fileLibraryMode) {
  documents[0].stage_id = fixtureStageId;
  documents[0].version_label = "v2";
  documents.push(
    {
      id: randomUUID(),
      project_id: pid,
      name: "Private agreement.pdf",
      category: "document",
      document_role: "Contract",
      published: false,
    },
    {
      id: randomUUID(),
      project_id: pid,
      stage_id: fixtureStageId,
      name: "Deposit invoice.pdf",
      category: "document",
      document_role: "Invoice",
      published: true,
    },
  );
  assets.push({
    id: randomUUID(),
    project_id: pid,
    stage_id: fixtureStageId,
    name: "Reference image.jpg",
    created_at: new Date().toISOString(),
  });
}
const errors = [];
let browser, app;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${fixturePort}`);
    const path = url.pathname;
    if (
      accessHelpMode &&
      !accessHelpConnected &&
      req.method === "GET" &&
      /^\/rest\/v1\/(clients|projects|project_notes|documents|questionnaires)(?:\/|$)/.test(
        path,
      )
    )
      accessPrivateReads++;
    if (
      (projectFinderMode || dashboardMode) &&
      /^\/rest\/v1\/(projects|clients|documents|client_assets|stages|profiles)$/.test(
        path,
      ) &&
      req.method !== "GET"
    )
      finderWrites++;
    res.setHeader("Access-Control-Allow-Origin", `http://127.0.0.1:${appPort}`);
    res.setHeader(
      "Access-Control-Allow-Headers",
      "authorization,apikey,x-client-info,content-type,x-upsert,cache-control",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,OPTIONS",
    );
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    const parts = [];
    for await (const chunk of req) parts.push(chunk);
    const raw = Buffer.concat(parts),
      text = raw.toString();
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
    if (secureMode && path === "/scan") {
      scanRequests++;
      assert.equal(req.headers.authorization, "Bearer fictional-scan-key");
      return json(
        {
          sha256: req.headers["x-file-sha256"],
          status: scannerInfected ? "infected" : "clean",
        },
        scannerOutage ? 503 : 200,
      );
    }
    if (secureMode && path.startsWith("/storage/v1/object/upload/sign/")) {
      const objectPath = path.split("/object/upload/sign/")[1];
      if (req.method === "POST")
        return json({
          url:
            "/object/upload/sign/" +
            objectPath +
            "?token=fictional-upload-only-token",
        });
      if (req.method === "PUT") {
        const boundary = (req.headers["content-type"] || "").split(
          "boundary=",
        )[1];
        const filePart = raw.indexOf("filename=");
        const start = raw.indexOf("\r\n\r\n", filePart) + 4;
        const end = raw.indexOf("\r\n--" + boundary, start);
        assert.ok(start > 3 && end > start);
        storedUploads.set(objectPath, raw.subarray(start, end));
        return json({ Key: objectPath });
      }
    }
    if (
      secureMode &&
      path.startsWith("/storage/v1/object/project-files/") &&
      req.method === "GET"
    ) {
      const bytes = storedUploads.get(path.split("/object/")[1]);
      if (!bytes) return json({ message: "Not found" }, 404);
      res.writeHead(200, { "Content-Type": "application/octet-stream" });
      return res.end(bytes);
    }
    if (
      secureMode &&
      path === "/storage/v1/object/project-files" &&
      req.method === "DELETE"
    ) {
      for (const path of body.prefixes)
        storedUploads.delete("project-files/" + path);
      return json([]);
    }
    if (secureMode && path === "/storage/v1/object/list/project-files")
      return json([]);
    if (
      portalChecksMode &&
      path === "/auth/v1/admin/users" &&
      req.method === "POST"
    ) {
      diagnosticAccountAttempts++;
      assert.equal(req.headers.apikey, "fictional-service-key");
      assert.match(body.email, /^aba-check-[0-9a-f-]+-0@example\.com$/);
      await new Promise((resolve) => setTimeout(resolve, 150));
      return json(
        {
          message:
            "Fictional provider outage; raw details must not reach the user",
        },
        diagnosticAccountAttempts === 1 ? 403 : 503,
      );
    }
    if (path === "/auth/v1/token")
      return json({
        access_token: jwt,
        refresh_token: "fictional-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user,
      });
    if (path === "/auth/v1/user") {
      if (req.method === "PUT") passwordUpdates.push(body);
      return json(user);
    }
    if (path === "/auth/v1/recover") {
      recoveryRequests.push(body);
      return json({});
    }
    if (path === "/auth/v1/otp") {
      otpRequests.push(body);
      return json({});
    }
    if (path === "/auth/v1/verify") {
      verifiedTypes.push(body.type);
      if (body.token_hash === "expired-fictional-token-at-least-20")
        return json({ msg: "Expired", code: "otp_expired" }, 403);
      return json({
        access_token: jwt,
        refresh_token: "fictional-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user,
      });
    }
    if (path === "/auth/v1/admin/generate_link") {
      generatedInvitations++;
      invitationAccount = inviteeUid;
      return json({
        id: inviteeUid,
        email: user.email,
        hashed_token: "fictional-private-token-at-least-20",
        action_link: "https://unused.example",
        verification_type: "invite",
      });
    }
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
    if (
      portalChecksMode &&
      req.method === "DELETE" &&
      ["projects", "clients", "invitations"].includes(table)
    ) {
      const filter = url.searchParams.get(
        table === "invitations" ? "client_id" : "id",
      );
      assert.ok(filter?.startsWith("in.("));
      assert.ok(!filter.includes(pid) && !filter.includes(cid));
      diagnosticCleanupScopes.push(table);
      return json([]);
    }
    if (projectFinderMode && table === "create_project") {
      finderCreationRequests++;
      createdFinderProjectId = randomUUID();
      finderProjects.push({
        id: createdFinderProjectId,
        client_id: body.target_client,
        name: body.project_name,
        type: body.project_type,
        due: body.due_date,
        budget: body.project_budget,
        contract_signed: false,
        deposit_paid: false,
        final_paid: false,
        final_approved: false,
        archived_at: null,
        separate_approvals: body.project_type === "Both",
      });
      finderExtraStages.push(
        ...body.template.map((stage, position) => ({
          ...stage,
          id: randomUUID(),
          project_id: createdFinderProjectId,
          position,
          status: "Not Started",
          visible: true,
        })),
      );
      return json(createdFinderProjectId);
    }
    if (table === "project_lifecycle_ready")
      return json(
        lifecycleMode || projectFinderMode || deadlinesMode || dashboardMode,
      );
    if (table === "file_security_ready") return json(secureMode);
    if (table === "reserve_file_upload") {
      intakes.push({
        id: body.upload_id,
        project_id: body.target,
        stage_id: body.stage,
        kind: body.upload_kind,
        bucket: "project-files",
        object_path: body.target + "/" + body.upload_id,
        name: body.file_name,
        expected_size: body.file_size,
        expected_sha256: body.file_hash,
        content_type: body.mime,
        status: "pending",
        expires_at: new Date(Date.now() + 7200000).toISOString(),
        discarded_at: null,
      });
      documents.push({
        id: body.upload_id,
        project_id: body.target,
        stage_id: body.stage,
        name: body.file_name,
        object_path: body.target + "/" + body.upload_id,
        category: body.category_name,
        document_role: body.role_name,
        version_label: body.version,
        published: false,
        scan_state: "pending",
      });
      return json(null);
    }
    if (table === "file_intake_for_check")
      return json(intakes.find((u) => u.id === body.target));
    if (table === "complete_file_check") {
      const u = intakes.find((u) => u.id === body.target),
        d = documents.find((d) => d.id === body.target);
      assert.equal(req.headers.apikey, "fictional-service-key");
      Object.assign(u, { status: body.verdict });
      Object.assign(d, { scan_state: body.verdict });
      return json(null);
    }
    if (table === "discard_file_intake") {
      const u = intakes.find((u) => u.id === body.target);
      u.discarded_at = new Date().toISOString();
      documents.splice(
        documents.findIndex((d) => d.id === u.id),
        1,
      );
      return json(null);
    }
    if (table === "archive_project") {
      Object.assign(project, {
        archived_at: body.archived ? new Date().toISOString() : null,
        archived_client_access: body.archived ? body.client_access : "retain",
      });
      return json(null);
    }
    if (table === "enable_stream_approvals") {
      project.separate_approvals = true;
      project.final_approved = false;
      return json(null);
    }
    if (table === "verify_stream_approval") {
      const existing = streamApprovals.find(
        (a) => a.stream === body.workstream,
      );
      if (existing) existing.confirmed = body.confirmed;
      else
        streamApprovals.push({
          project_id: pid,
          stream: body.workstream,
          confirmed: body.confirmed,
          checked_at: new Date().toISOString(),
          checked_by: uid,
        });
      project.final_approved =
        streamApprovals.filter((a) => a.confirmed).length === 2;
      verificationHistory.unshift({
        id: randomUUID(),
        project_id: pid,
        field:
          body.workstream === "Brand Identity"
            ? "brand_approved"
            : "website_approved",
        confirmed: body.confirmed,
        recorded_at: new Date().toISOString(),
        actor_id: uid,
        reference: body.reference,
        occurred_on: null,
        document_id: null,
        document_label: null,
        invoice_id: null,
        source: "stream_approval",
      });
      return json(null);
    }
    if (table === "verify_project_record") {
      project[body.record_field] = body.confirmed;
      verificationHistory.unshift({
        id: randomUUID(),
        project_id: pid,
        field: body.record_field,
        confirmed: body.confirmed,
        recorded_at: new Date().toISOString(),
        actor_id: uid,
        reference: body.reference,
        occurred_on: body.occurred_on,
        document_id: null,
        document_label: null,
        invoice_id: null,
        source: "owner_check",
      });
      return json(null);
    }
    if (table === "stage_purposes_ready")
      return purposesMode
        ? json(true)
        : json({ code: "PGRST202", message: "Function unavailable" }, 404);
    if (table === "client_invitations_ready")
      return json(invitationsMode || workspaceHelpMode);
    if (table === "client_portal_statuses")
      return json([
        {
          client_id: cid,
          eligible: true,
          state: portalState,
          invited_at: portalInvitedAt,
          accepted_at:
            portalState === "connected" ? "2027-07-03T23:30:00.000Z" : null,
          expires_at: portalExpiresAt,
        },
      ]);
    if (table === "client_invitation_account") return json(invitationAccount);
    if (table === "record_client_invitation") {
      portalState = "pending";
      const created =
        Date.parse("2027-07-01T23:30:00.000Z") + invitationRevision++ * 60000;
      portalInvitedAt = new Date(created).toISOString();
      portalExpiresAt = new Date(created + 7 * 86400000).toISOString();
      return json(randomUUID());
    }
    if (table === "revoke_client_access") {
      portalState = "revoked";
      return json(null);
    }
    if (table === "accept_invitation") return json(null);

    if (table === "prospect_spaces_ready")
      return json(
        prospectMode ||
          prospectOwnerMode ||
          enquiriesMode ||
          workspaceHelpMode ||
          deadlinesMode,
      );
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
      return json(contractMode || contractOwnerMode || workspaceHelpMode);
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
        financeMode ||
          stageMode ||
          contractMode ||
          contractOwnerMode ||
          workspaceHelpMode ||
          deadlinesMode,
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
        reviewDatesMode
          ? reviewDatesReady
          : secureMode ||
              deadlinesMode ||
              lifecycleMode ||
              managementMode ||
              stageMode ||
              contractMode ||
              contractOwnerMode ||
              workspaceHelpMode ||
              fileLibraryMode,
      );
    if (table === "complete_client_action") {
      const a = clientActions.find((a) => a.id === body.target);
      if (a) a.status = body.done ? "Done" : "To do";
      return json(null);
    }

    let rows = [];
    if (table === "prospect_spaces")
      rows = deadlinesMode
        ? [
            {
              ...prospective,
              project_id: combinedFinderId,
              enabled: true,
              enquiry_status: "closed",
            },
          ]
        : prospectMode ||
            prospectOwnerMode ||
            enquiriesMode ||
            workspaceHelpMode
          ? [prospective]
          : [];
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
      rows =
        accessHelpMode && !accessHelpConnected
          ? []
          : [
              {
                id: uid,
                role:
                  ownerMode && (!reviewDatesMode || reviewDateOwner)
                    ? "admin"
                    : "client",
                client_id:
                  ownerMode && (!reviewDatesMode || reviewDateOwner)
                    ? null
                    : cid,
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
    if (
      (projectFinderMode || deadlinesMode || dashboardMode) &&
      table === "clients"
    )
      rows.push({
        id: finderClientId,
        name: "Málaga Studio",
        contact: "Fictional Client",
        email: "malaga@example.com",
        sector: "Design",
      });
    if (table === "contract_exchanges") {
      if (req.method === "POST") exchangeEnabled = body.enabled;
      rows = [
        { project_id: pid, stage_id: fixtureStageId, enabled: exchangeEnabled },
      ];
    }
    if (table === "upload_intakes")
      rows = intakes.filter((u) => u.status !== "clean" && !u.discarded_at);
    if (table === "project_verifications") rows = verificationHistory;
    if (table === "project_stream_approvals") rows = streamApprovals;
    if (table === "projects") {
      if (req.method === "PATCH") Object.assign(project, body);
      rows = [project];
    }
    if (
      (projectFinderMode || deadlinesMode || dashboardMode) &&
      table === "projects"
    )
      rows = finderProjects;
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
        (project.final_paid && project.final_approved) || workspaceHelpMode
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
    if (purposesMode && table === "stages" && req.method === "PATCH") {
      if (body.name !== undefined) stageName = body.name;
      if (body.purpose !== undefined) stagePurpose = body.purpose;
    }
    if (table === "stages")
      rows = [
        {
          id: fixtureStageId,
          project_id: pid,
          ...(purposesMode ? { purpose: stagePurpose } : {}),
          name:
            verificationMode || contractOwnerMode || contractMode
              ? stageName
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
    if ((projectFinderMode || dashboardMode) && table === "stages")
      rows = [...rows, ...finderExtraStages];
    if (table === "stages" && templateMode) rows = liveTemplate;
    if (table === "stages" && (prospectMode || prospectOwnerMode))
      rows = potentialStages;
    if (workspaceHelpMode && table === "stages")
      rows = [
        {
          id: fixtureStageId,
          project_id: pid,
          name: "Contract",
          stream: "Onboarding",
          position: 0,
          status: "Awaiting Client",
          visible: true,
        },
        {
          id: goodbyeStageId,
          project_id: pid,
          name: "Goodbye Packet",
          stream: "Handover",
          position: 1,
          status: "Not Started",
          visible: true,
        },
      ];
    if (stageMode || verificationMode) documents[0].stage_id = fixtureStageId;
    if (reviewDatesMode && table === "documents" && req.method === "PATCH") {
      reviewDateWrites.push({
        body,
        id: url.searchParams.get("id"),
        category: url.searchParams.get("category"),
      });
      if (failReviewDateSave)
        return json({ message: "Fictional save failure" }, 503);
      for (const d of documents)
        if (
          url.searchParams.get("id") === "eq." + d.id &&
          url.searchParams.get("category") === "eq." + d.category
        )
          Object.assign(d, body);
    }
    if (table === "documents")
      rows =
        workspaceHelpMode || (secureMode && ownerMode)
          ? documents
          : documents.filter(
              (d) =>
                d.category !== "final" ||
                (project.final_paid && project.final_approved),
            );
    if (fileLibraryMode && table === "documents")
      rows = documents.filter(
        (d) =>
          ownerMode ||
          (d.published &&
            (d.category !== "final" ||
              (project.final_paid && project.final_approved))),
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
    if (
      reviewDatesMode &&
      table === "documents" &&
      req.method === "PATCH" &&
      rows.length !== 1 &&
      (req.headers.accept || "").includes("vnd.pgrst.object+json")
    )
      return json({ code: "PGRST116", message: "Expected one document" }, 406);
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
          UPLOAD_SCAN_URL:
            secureMode && !secureUnconfiguredMode
              ? `http://127.0.0.1:${fixturePort}/scan`
              : "",
          UPLOAD_SCAN_KEY:
            secureMode && !secureUnconfiguredMode ? "fictional-scan-key" : "",
          SUPABASE_SERVICE_ROLE_KEY:
            invitationsMode || secureMode || portalChecksMode
              ? "fictional-service-key"
              : "",
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
      timezoneId:
        invitationsMode || deadlinesMode || insightsMode
          ? "America/Los_Angeles"
          : undefined,
    });
    if (deadlinesMode || insightsMode)
      await page.clock.setFixedTime(deadlineClock);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /same key|unique .*key/i.test(message.text())
      )
        errors.push(message.text());
    });
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
    if (accountMode) {
      await page.goto(`http://127.0.0.1:${appPort}/reset-password`);
      await page.waitForURL("**/login?error=reset");
      await page
        .getByRole("button", { name: "Send password-reset link", exact: true })
        .waitFor();
      const reset = page.locator("form").filter({
        has: page.getByRole("button", { name: "Send password-reset link" }),
      });
      await reset.getByLabel("Email address").fill("fictional@example.com");
      await reset.getByRole("button").click();
      await reset.getByText(/If an account exists/).waitFor();
      assert.equal(recoveryRequests.length, 1);
      await page.getByText("Sign in by email instead", { exact: true }).click();
      const emailForm = page.locator("form").filter({
        has: page.getByRole("button", {
          name: "Request sign-in link",
          exact: true,
        }),
      });
      await emailForm.getByLabel("Email address").fill("fictional@example.com");
      await emailForm.getByRole("button").click();
      await emailForm
        .getByText(/If this email has an invited account/)
        .waitFor();
      assert.equal(otpRequests.length, 1);
      assert.equal(otpRequests[0].create_user, false);
      await captureUi("login-help");
    }
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
    if (accessHelpMode) {
      await page.waitForURL("**/access");
      await expect(page.locator(".signed-in-account")).toContainText(
        "different-account@example.com",
      );
      await expect(
        page.getByText("fictional@example.com", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", {
          name: "Email Alex about portal access",
          exact: true,
        }),
      ).toHaveAttribute("href", "mailto:Alex.bell.arts@outlook.com");
      await expect(
        page.getByRole("heading", {
          name: "Fictional client journey",
          exact: true,
        }),
      ).toHaveCount(0);
      assert.equal(accessPrivateReads, 0);
      await page
        .getByRole("link", { name: "Check my access again", exact: true })
        .click();
      await page.waitForURL("**/access");
      await captureUi("account-access-help");
      await page
        .getByRole("button", {
          name: "Sign out and use another account",
          exact: true,
        })
        .click();
      await page.waitForURL("**/login");
      await page.goto(`http://127.0.0.1:${appPort}/access`);
      await page.waitForURL("**/login");
      await expect(page.locator(".signed-in-account")).toHaveCount(0);
      assert.equal(accessPrivateReads, 0);
      accessHelpConnected = true;
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
      await page.waitForURL("**/portal");
      await page.goto(`http://127.0.0.1:${appPort}/access`);
      await page.waitForURL("**/portal");
      await page
        .getByRole("heading", { name: "Fictional client journey", exact: true })
        .waitFor();
      assert.deepEqual(errors, []);
      console.log(
        "PASS: access help shows only the authenticated account email, gives a fixed support link, makes no private project/client reads without membership, supports safe sign-out, and redirects connected accounts to their portal. Phone/desktop fixture checks only.",
      );
      return;
    }
    if (reviewDatesMode) {
      const flagsBefore = JSON.stringify(project);
      const documentBefore = { ...documents[0] };
      const planner = page.getByRole("region", {
        name: "Dates & deadlines",
        exact: true,
      });
      await planner
        .getByRole("button", { name: /Fictional presentation.pdf/ })
        .click();
      const stage = page.locator("#stage-" + fixtureStageId);
      const editor = stage.getByRole("group", {
        name: "Review date for Fictional presentation.pdf",
        exact: true,
      });
      const library = page.locator(".project-file-library");
      const libraryEditor = library.getByRole("group", {
        name: "Review date for Fictional presentation.pdf",
        exact: true,
      });
      await expect(editor.locator("time")).toHaveAttribute(
        "datetime",
        deadlineDate(2),
      );
      await editor.getByText("Change review date", { exact: true }).click();
      const input = editor.getByLabel("Feedback due date", { exact: true });
      const save = editor.getByRole("button", {
        name: "Save review date",
        exact: true,
      });
      await input.fill(deadlineDate(10));
      await save.click();
      await expect(editor.locator("time")).toHaveAttribute(
        "datetime",
        deadlineDate(10),
      );
      await expect(libraryEditor.locator("time")).toHaveAttribute(
        "datetime",
        deadlineDate(10),
      );
      await expect(input).toHaveValue(deadlineDate(10));
      assert.deepEqual(documents[0], {
        ...documentBefore,
        review_due: deadlineDate(10),
      });
      assert.deepEqual(reviewDateWrites[0], {
        body: { review_due: deadlineDate(10) },
        id: "eq." + presentation,
        category: "eq.presentation",
      });
      await captureUi("review-date-editor", editor);
      await page.getByRole("button", { name: "Overview", exact: true }).click();
      await expect(
        planner.getByRole("button", { name: /Fictional presentation.pdf/ }),
      ).toHaveCount(0);
      await planner
        .getByLabel("Date range", { exact: true })
        .selectOption("month");
      await planner
        .getByRole("button", { name: /Fictional presentation.pdf/ })
        .click();
      await libraryEditor
        .getByText("Change review date", { exact: true })
        .click();
      await libraryEditor
        .getByLabel("Feedback due date", { exact: true })
        .fill("");
      await libraryEditor
        .getByRole("button", { name: "Save review date", exact: true })
        .click();
      await expect(libraryEditor).toContainText("Review date to be agreed.");
      await expect(editor).toContainText("Review date to be agreed.");
      assert.equal(documents[0].review_due, null);
      await page.reload();
      await expect(
        planner.getByRole("button", { name: /Fictional presentation.pdf/ }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      await stage.locator("summary").first().click();
      await editor.getByText("Change review date", { exact: true }).click();
      await expect(input).toHaveValue("");
      await editor.locator("form").evaluate((form) => {
        form.addEventListener(
          "formdata",
          (event) => {
            event.formData.set("review_due", "2027-02-30");
          },
          { once: true },
        );
      });
      await save.click();
      await expect(editor.getByRole("status")).toContainText(
        "Please check the form fields",
      );
      assert.equal(
        reviewDateWrites.length,
        2,
        "invalid calendar date never reaches the database",
      );
      await input.fill(deadlineDate(3));
      reviewDateOwner = false;
      await save.click();
      await expect(editor.getByRole("status")).toContainText(
        "You do not have access",
      );
      assert.equal(
        reviewDateWrites.length,
        2,
        "owner check is repeated at submission",
      );
      reviewDateOwner = true;
      reviewDatesReady = false;
      await save.click();
      await expect(editor.getByRole("status")).toContainText(
        "project management SQL upgrade",
      );
      assert.equal(
        reviewDateWrites.length,
        2,
        "missing capability never attempts an update",
      );
      reviewDatesReady = true;
      failReviewDateSave = true;
      await save.click();
      await expect(editor.getByRole("status")).toContainText(
        "The change could not be saved",
      );
      assert.equal(documents[0].review_due, null);
      await expect(editor).toContainText("Review date to be agreed.");
      await expect(input).toHaveValue(deadlineDate(3));
      failReviewDateSave = false;
      await editor.locator("form").evaluate((form, value) => {
        form.addEventListener(
          "formdata",
          (event) => {
            event.formData.set("id", value);
          },
          { once: true },
        );
      }, finalDoc);
      await save.click();
      await expect.poll(() => reviewDateWrites.length).toBe(4);
      await expect(editor.getByRole("status")).toContainText(
        "The change could not be saved",
      );
      assert.equal(
        documents[1].review_due,
        undefined,
        "a forged non-presentation ID does not receive a date",
      );
      feedback.push({
        id: randomUUID(),
        document_id: presentation,
        decision: "approved",
        body: "Fictional approved version",
        approver_name: "Jamie Example",
        reviewed_version: "v2",
        created_at: new Date().toISOString(),
      });
      await save.click();
      await expect(editor.locator("time")).toHaveAttribute(
        "datetime",
        deadlineDate(3),
      );
      await expect(editor).toContainText(
        "This version already has a review response",
      );
      const feedbackBefore = JSON.stringify(feedback);
      await input.fill(deadlineDate(4));
      await save.click();
      await expect(editor.locator("time")).toHaveAttribute(
        "datetime",
        deadlineDate(4),
      );
      assert.equal(JSON.stringify(feedback), feedbackBefore);
      assert.deepEqual(documents[0], {
        ...documentBefore,
        review_due: deadlineDate(4),
      });
      assert.equal(JSON.stringify(project), flagsBefore);
      await page.getByRole("button", { name: "Overview", exact: true }).click();
      await planner
        .getByLabel("Date range", { exact: true })
        .selectOption("all");
      await expect(
        planner.getByRole("button", { name: /Fictional presentation.pdf/ }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      await page.getByRole("button", { name: /Preview client portal/ }).click();
      await expect(
        page.getByText("Change review date", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page
          .getByRole("group", {
            name: "Review date for Fictional presentation.pdf",
            exact: true,
          })
          .last()
          .locator("time"),
      ).toHaveAttribute("datetime", deadlineDate(4));
      await captureUi("review-date-client");
      assert.deepEqual(errors, []);
      console.log(
        "PASS: presentation dates can be rescheduled/cleared from stage/library and survive reload; planner updates, invalid dates/forged categories/role changes/missing capability/save failures are rejected, and reviewed versions, feedback, release flags and client read-only dates remain intact. Fictional browser checks only.",
      );
      return;
    }
    if (deadlinesMode) {
      const flagsBefore = JSON.stringify(project);
      const planner = page.getByRole("region", {
        name: "Dates & deadlines",
        exact: true,
      });
      await planner
        .getByText("3 dates in this view", { exact: true })
        .waitFor();
      await expect(planner.locator(".deadline-item")).toHaveCount(3);
      await expect(planner).toContainText("Today");
      await expect(planner).toContainText("Tomorrow");
      await expect(planner.locator("time").first()).toHaveAttribute(
        "datetime",
        deadlineToday,
      );
      await expect(planner).not.toContainText("Archived identity");
      await expect(planner).not.toContainText("Brand and website");
      await expect(planner).not.toContainText("Finished task");
      await captureUi("deadline-week", planner);
      await planner
        .getByRole("button", { name: "1 overdue", exact: true })
        .click();
      await expect(planner.locator(".deadline-item")).toHaveCount(1);
      await expect(planner).toContainText("Overdue content checklist");
      await expect(planner).not.toContainText("Supply approved brand assets");
      await planner
        .getByRole("combobox", { name: "Date range", exact: true })
        .selectOption("all");
      await planner
        .getByRole("button", { name: "Show all 8 dates", exact: true })
        .click();
      await expect(planner.locator(".deadline-item")).toHaveCount(8);
      await planner
        .getByRole("combobox", { name: "Date range", exact: true })
        .selectOption("month");
      await expect(planner.locator(".deadline-item")).toHaveCount(4);
      await planner.getByRole("button", { name: /Framer website/ }).click();
      await expect(
        page.getByLabel("Select project", { exact: true }),
      ).toHaveValue(websiteProjectId);
      await expect(page.locator(".project-summary h2")).toHaveText(
        "Framer website",
      );
      await page.getByRole("button", { name: "Overview", exact: true }).click();
      await planner
        .getByRole("button", { name: /Supply approved brand assets/ })
        .click();
      const action = page
        .locator("#client-actions .client-action")
        .filter({ hasText: "Supply approved brand assets" });
      await action
        .getByRole("button", { name: "Mark done", exact: true })
        .click();
      await action
        .getByRole("button", { name: "Mark to do", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Overview", exact: true }).click();
      await expect(planner).not.toContainText("Supply approved brand assets");
      await planner
        .getByRole("button", { name: /Fictional presentation.pdf/ })
        .click();
      await expect(page.locator("#stage-" + fixtureStageId)).toHaveAttribute(
        "open",
        "",
      );
      feedback.push({
        id: randomUUID(),
        document_id: presentation,
        body: "Fictional revision response",
        decision: "changes_requested",
        created_at: new Date().toISOString(),
      });
      await page.reload();
      await planner.getByText("1 date in this view", { exact: true }).waitFor();
      await expect(planner).not.toContainText("Fictional presentation.pdf");
      assert.equal(JSON.stringify(project), flagsBefore);
      await page.getByRole("button", { name: /Preview client portal/ }).click();
      await expect(planner).toHaveCount(0);
      assert.deepEqual(errors, []);
      console.log(
        "PASS: owner deadline ranges/overdue/more controls, archived/closed/completed exclusion, project/task/stage navigation, completed task and review removal, unchanged project verification flags, client-preview exclusion and phone/desktop layouts. Fictional services only.",
      );
      return;
    }
    if (projectFinderMode) {
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      const finder = page.getByRole("region", {
          name: "Find a project",
          exact: true,
        }),
        picker = page.getByLabel("Select project", { exact: true });
      await expect(finder.getByRole("status")).toContainText(
        "Showing 3 of 3 projects",
      );
      await finder
        .getByLabel("Search projects", { exact: true })
        .fill("combined");
      await expect(picker).toHaveValue(combinedFinderId);
      await finder
        .getByLabel("Search projects", { exact: true })
        .fill("malaga framer");
      await expect(picker).toHaveValue(websiteProjectId);
      await expect(picker.locator("option")).toHaveCount(1);
      await finder
        .getByLabel("Project type", { exact: true })
        .selectOption("Brand Identity");
      await expect(picker).toHaveCount(0);
      await expect(page.getByText(/^No projects in this view/)).toBeVisible();
      await finder
        .getByRole("button", { name: "Clear project filters", exact: true })
        .click();
      await expect(picker.locator("option")).toHaveCount(3);
      await finder
        .getByLabel("Sort projects", { exact: true })
        .selectOption("due");
      assert.deepEqual(
        await picker
          .locator("option")
          .evaluateAll((options) => options.map((o) => o.value)),
        [websiteProjectId, pid, combinedFinderId],
      );
      await expect(picker).toHaveValue(pid);
      await finder.getByLabel("Project list filter").selectOption("archived");
      await expect(picker).toHaveValue(archivedFinderId);
      await finder.getByLabel("Project list filter").selectOption("all");
      await expect(picker.locator("option")).toHaveCount(4);
      await expect(picker).toHaveValue(archivedFinderId);
      await finder
        .getByLabel("Search projects", { exact: true })
        .fill("archived");
      await page.getByRole("button", { name: "Overview", exact: true }).click();
      await page
        .locator(".list-row")
        .filter({ hasText: "Fictional client journey" })
        .click();
      await expect(picker).toHaveValue(pid);
      await expect(
        finder.getByLabel("Search projects", { exact: true }),
      ).toHaveValue("");
      await expect(finder.getByLabel("Project list filter")).toHaveValue(
        "active",
      );
      await expect(
        finder.getByLabel("Sort projects", { exact: true }),
      ).toHaveValue("current");
      await finder.getByLabel("Project list filter").selectOption("archived");
      await finder
        .getByLabel("Search projects", { exact: true })
        .fill("archived");
      await page.getByRole("button", { name: "Overview", exact: true }).click();
      const phases = page.getByRole("region", {
        name: "Projects by phase",
        exact: true,
      });
      await phases.getByRole("button", { name: /^Branding/ }).click();
      await phases
        .getByRole("button", { name: /Fictional client journey/ })
        .click();
      await expect(picker).toHaveValue(pid);
      await expect(
        finder.getByLabel("Search projects", { exact: true }),
      ).toHaveValue("");
      await finder
        .getByLabel("Project type", { exact: true })
        .selectOption("Website Design");
      await expect(picker).toHaveValue(websiteProjectId);
      await captureUi("project-finder", finder);
      await page.getByRole("button", { name: /Preview client portal/ }).click();
      await expect(finder).toHaveCount(0);
      await expect(
        page.getByLabel("Select project", { exact: true }).locator("option"),
      ).toHaveCount(1);
      await expect(
        page.getByText("Archived identity", { exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Back to owner workspace", exact: true })
        .click();
      await expect(picker).toHaveValue(websiteProjectId);
      assert.equal(finderWrites, 0);
      await finder.getByLabel("Project list filter").selectOption("archived");
      await finder
        .getByLabel("Project type", { exact: true })
        .selectOption("Both");
      await expect(picker).toHaveCount(0);
      await page
        .getByRole("button", { name: "New project", exact: true })
        .click();
      const create = page.locator("form").filter({
        has: page.getByRole("button", {
          name: "Create project",
          exact: true,
        }),
      });
      await create
        .getByLabel("Project name", { exact: true })
        .fill("Newly created design");
      await create.getByLabel("Client").selectOption(finderClientId);
      await create.getByLabel("Workflow").selectOption("Brand Identity");
      await create
        .getByLabel("Estimated completion", { exact: true })
        .fill("2027-04-01");
      await create.getByLabel("Project value (£)", { exact: true }).fill("500");
      await create
        .getByRole("button", { name: "Create project", exact: true })
        .click();
      await expect(create.getByRole("status")).toContainText(
        "Project created.",
      );
      await expect(finder.getByLabel("Project list filter")).toHaveValue(
        "active",
      );
      await expect(
        finder.getByLabel("Project type", { exact: true }),
      ).toHaveValue("all");
      await expect(
        picker.locator("option").filter({ hasText: "Newly created design" }),
      ).toHaveCount(1);
      assert.equal(finderCreationRequests, 1);
      const made = finderProjects.find((p) => p.id === createdFinderProjectId);
      assert.equal(made.contract_signed, false);
      assert.equal(made.deposit_paid, false);
      assert.equal(made.final_paid, false);
      assert.equal(made.final_approved, false);
      assert.deepEqual(errors, []);
      console.log(
        "PASS: owner project/client search with accents, service/archive combinations, stable estimated-date sorting, selection retention, no-results/reset, overview/drill-down recovery, client-preview exclusion, newly created projects visible after filter reset and responsive layouts. Filtering does not mutate records; fictional services only.",
      );
      return;
    }
    if (portalChecksMode) {
      const panel = page.locator(".portal-check");
      await panel.locator("summary").first().click();
      const run = panel.getByRole("button", {
        name: "Run automatic portal checks",
        exact: true,
      });
      await run.click();
      const results = panel.getByRole("list", { name: "Portal check results" });
      await results.waitFor();
      await expect(results.locator("li")).toHaveCount(6);
      await expect(
        results.locator("li").filter({ hasText: "Accounts & project privacy" }),
      ).toContainText("Needs attention");
      await expect(
        results.locator("li").filter({ hasText: "Questionnaires & feedback" }),
      ).toContainText("Not run");
      await expect(
        results
          .locator("li")
          .filter({ hasText: "Archives, evidence & combined approvals" }),
      ).toContainText("Not run");
      await expect(
        results.locator("li").filter({ hasText: "Temporary data cleanup" }),
      ).toContainText("Passed");
      await expect(panel).toContainText(
        "Temporary account creation could not be completed.",
      );
      await expect(panel).not.toContainText("raw details must not reach");
      await expect(run).toBeEnabled();
      await run.click();
      await expect.poll(() => diagnosticAccountAttempts).toBe(2);
      await expect(
        results.locator("li").filter({ hasText: "Temporary data cleanup" }),
      ).toContainText("Needs attention");
      await expect(panel).toContainText("account creation outcome unknown");
      await expect(panel).not.toContainText(
        "Temporary accounts, files and records were removed",
      );
      await expect(run).toBeDisabled();
      await expect(panel).toContainText(
        "finish its cleanup before starting another check",
      );
      await captureUi("portal-check-results", panel);
      await page.reload();
      await panel.locator("summary").first().click();
      await page.route("**/workspace", async (route) => {
        if (
          route.request().method() === "POST" &&
          route.request().headers()["next-action"]
        )
          return route.fulfill({
            status: 503,
            contentType: "text/plain",
            body: "Fictional interrupted action",
          });
        return route.continue();
      });
      await run.click();
      await expect(panel).toContainText("The check was interrupted.");
      await expect(run).toBeDisabled();
      assert.equal(diagnosticAccountAttempts, 2);

      assert.deepEqual([...new Set(diagnosticCleanupScopes)].sort(), [
        "clients",
        "invitations",
        "projects",
      ]);
      assert.equal(recoveryRequests.length, 0);
      assert.equal(generatedInvitations, 0);
      assert.equal(clientDeleted, false);
      assert.deepEqual(errors, []);
      console.log(
        "PASS: actual owner diagnostic action, clear failed/not-run/cleanup result groups, provider error redaction, safe retry after a confirmed refusal and blocked retry after unknown cleanup, cleanup scoped away from existing records and 320/390/1440 layouts. Fictional services only.",
      );
      return;
    }
    if (secureUnconfiguredMode) {
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      const preparation = page.locator("#handover-preparation");
      await preparation.locator("summary").first().click();
      await expect(preparation).toContainText(
        "New uploads are unavailable until file security checks are connected",
      );
      await expect(page.locator("form.secure-upload")).toHaveCount(0);
      assert.equal(intakes.length, 0);
      assert.equal(scanRequests, 0);
      assert.equal(project.final_paid, false);
      assert.equal(project.final_approved, false);
      await captureUi("handover-unconfigured", preparation);
      assert.deepEqual(errors, []);
      console.log(
        "PASS: unconfigured secure uploads show unavailable guidance without an unchecked upload form, scanner call, reservation or changed release flags. Fictional services only.",
      );
      return;
    }
    if (secureMode) {
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      const preparation = page.locator("#handover-preparation");
      await preparation.locator("summary").first().click();
      await expect(preparation).toContainText(
        "Illustrator and ZIP files up to 25 MB",
      );
      await preparation.getByText(/Review delivery files/).click();
      const library = page.getByRole("region", {
        name: "All project files",
        exact: true,
      });
      await library
        .locator("details")
        .filter({
          has: page.getByText("Upload a project-wide file", { exact: true }),
        })
        .locator("summary")
        .click();
      const upload = library.locator("form.secure-upload");
      const large = Buffer.concat([
        Buffer.from("%PDF-1.7\n"),
        Buffer.alloc(5 * 1024 * 1024, 32),
        Buffer.from("\n%%EOF"),
      ]);
      await upload.getByLabel("File", { exact: true }).setInputFiles({
        name: "Fictional large proof.pdf",
        mimeType: "application/pdf",
        buffer: large,
      });
      await upload.locator('select[name="category"]').selectOption("final");
      await upload
        .getByRole("button", { name: "Upload file securely", exact: true })
        .click();
      await expect(upload.getByRole("status")).toContainText(
        "File checked and ready",
        { timeout: 20000 },
      );
      assert.equal(intakes[0].status, "clean");
      assert.equal(
        storedUploads.get("project-files/" + intakes[0].object_path).length,
        large.length,
      );
      assert.equal(documents.at(-1).published, false);
      const reviewed = preparation
        .locator(".delivery-file-list > li")
        .filter({ hasText: "Fictional large proof.pdf" });
      await expect(reviewed).toContainText("private draft");
      await expect(reviewed).toContainText("final creative approval");
      const item = library
        .locator(".document-item")
        .filter({ hasText: "Fictional large proof.pdf" });
      await expect(
        item.getByRole("link", { name: /Download securely/ }),
      ).toBeVisible();
      scannerOutage = true;
      await upload.getByLabel("File", { exact: true }).setInputFiles({
        name: "Fictional retry.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.7\nFictional retry\n%%EOF"),
      });
      await upload.locator('select[name="category"]').selectOption("final");
      await upload
        .getByRole("button", { name: "Upload file securely", exact: true })
        .click();
      await expect(upload.getByRole("status")).toContainText(
        "remains quarantined",
        { timeout: 20000 },
      );
      const pendingReview = preparation
        .locator(".delivery-file-list > li")
        .filter({ hasText: "Fictional retry.pdf" });
      await expect(pendingReview).toContainText("awaiting security checks");
      const blocked = library
        .locator(".document-item")
        .filter({ hasText: "Fictional retry.pdf" });
      await expect(
        blocked.getByRole("link", { name: /Download securely/ }),
      ).toHaveCount(0);
      await expect(
        blocked.getByRole("button", { name: "Publish to client", exact: true }),
      ).toHaveCount(0);
      scannerOutage = false;
      scannerInfected = true;
      const queue = library.locator(".upload-queue");
      await queue.locator("summary").click();
      await queue
        .getByRole("button", { name: "Retry security check", exact: true })
        .click();
      await expect(queue).toContainText("Blocked — choose another file.");
      await expect(pendingReview).toContainText("blocked by security checks");
      await queue
        .getByRole("button", {
          name: "Discard quarantined upload",
          exact: true,
        })
        .click();
      await expect(blocked).toHaveCount(0);
      await expect(pendingReview).toHaveCount(0);
      assert.ok(intakes[1].discarded_at);
      assert.equal(scanRequests, 3);
      assert.equal(project.contract_signed, true);
      assert.equal(project.deposit_paid, true);
      assert.equal(project.final_approved, false);
      assert.equal(project.final_paid, false);
      await captureUi("secure-upload-library");
      assert.deepEqual(errors, []);
      console.log(
        "PASS: 5 MB direct private upload, server byte/hash check, scanner outage quarantine, blocked verdict, retry/discard, unchanged sharing/release controls and responsive layouts. Fictional scanner only.",
      );
      return;
    }
    if (lifecycleMode) {
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      const history = page.locator("#project-history");
      await history.locator("summary").click();
      await expect(history).toContainText(
        "Earlier checks have no recorded date",
      );
      const verification = page.locator("#project-verification");
      await verification.locator("summary").first().click();
      const opt = verification.locator("details").filter({
        has: page.getByText("Use separate branding and website approvals", {
          exact: true,
        }),
      });
      await opt.locator("summary").first().click();
      await opt.getByRole("checkbox").check();
      await opt
        .getByRole("button", {
          name: "Enable separate approval checks",
          exact: true,
        })
        .click();
      await verification
        .getByRole("button", {
          name: "Verify Brand Identity approval",
          exact: true,
        })
        .waitFor();
      assert.equal(project.final_approved, false);
      const brand = verification.locator("form").filter({
        has: page.getByRole("button", {
          name: "Verify Brand Identity approval",
          exact: true,
        }),
      });
      await brand.locator("summary").click();
      await brand
        .getByLabel("Reference or note")
        .fill("Fictional branding approval email");
      await brand.getByRole("checkbox").check();
      await brand.getByRole("button").click();
      await verification
        .getByRole("button", {
          name: "Remove Brand Identity approval",
          exact: true,
        })
        .waitFor();
      assert.equal(project.final_approved, false);
      const web = verification.locator("form").filter({
        has: page.getByRole("button", {
          name: "Verify Website Design approval",
          exact: true,
        }),
      });
      await web.getByRole("checkbox").check();
      await web.getByRole("button").click();
      await verification
        .getByRole("button", {
          name: "Remove Website Design approval",
          exact: true,
        })
        .waitFor();
      assert.equal(project.final_approved, true);
      await expect(history).toContainText("Fictional branding approval email");
      const remove = verification.locator("form").filter({
        has: page.getByRole("button", {
          name: "Remove Brand Identity approval",
          exact: true,
        }),
      });
      await remove.getByRole("checkbox").check();
      await remove.getByRole("button").click();
      await verification
        .getByRole("button", {
          name: "Verify Brand Identity approval",
          exact: true,
        })
        .waitFor();
      assert.equal(project.final_approved, false);
      await history
        .getByLabel("Client access after archiving")
        .selectOption("retain");
      await history.getByRole("checkbox").check();
      await history
        .getByRole("button", { name: "Archive project", exact: true })
        .click();
      await expect(page.getByText(/^No projects in this view/)).toBeVisible();
      await page.getByLabel("Project list filter").selectOption("archived");
      await expect(
        page.getByText(/Existing client access is retained as read-only/),
      ).toBeVisible();
      const preparation = page.locator("#handover-preparation");
      await preparation.locator("summary").first().click();
      await expect(preparation).toContainText(
        "Existing client access is read-only",
      );
      await page.getByRole("button", { name: /Preview client portal/ }).click();
      const buttons = await page.locator("form button[type=submit]").all();
      for (const b of buttons) await expect(b).toBeDisabled();
      await page
        .getByRole("button", { name: "Back to owner workspace", exact: true })
        .click();
      await history.locator("summary").click();
      await history.getByRole("checkbox").check();
      await history
        .getByRole("button", { name: "Restore project", exact: true })
        .click();
      await page.getByLabel("Project list filter").selectOption("active");
      await history.locator("summary").click();
      await history
        .getByLabel("Client access after archiving")
        .selectOption("suspend");
      await history.getByRole("checkbox").check();
      await history
        .getByRole("button", { name: "Archive project", exact: true })
        .click();
      await page.getByLabel("Project list filter").selectOption("archived");
      if (!(await preparation.evaluate((el) => el.open)))
        await preparation.locator("summary").first().click();
      await expect(preparation).toContainText(
        "Client access is suspended for this archived project",
      );
      await page.getByRole("button", { name: /Preview client portal/ }).click();
      await expect(
        page.getByText(/This archived project is not available to the client/),
      ).toBeVisible();
      await captureUi("archive-suspended-preview");
      assert.deepEqual(errors, []);
      console.log(
        "PASS: separate combined approvals/revocation, private evidence, deliberate archive retain/suspend, read-only previews and narrow/wide layouts. Fictional services only.",
      );
      return;
    }
    if (fileLibraryMode) {
      if (ownerMode)
        await page
          .getByRole("button", { name: "Projects", exact: true })
          .click();
      const library = page.getByRole("region", {
        name: "All project files",
        exact: true,
      });
      await library
        .getByRole("heading", { name: "Concept review", exact: true })
        .waitFor();
      await expect(library.locator(".document-item")).toHaveCount(
        ownerMode ? 5 : 3,
      );
      const search = library.getByRole("searchbox", { name: "Search files" });
      await search.fill("v2");
      await expect(library.locator(".document-item")).toHaveCount(1);
      await library
        .getByRole("button", { name: "Clear filters", exact: true })
        .click();
      await library
        .getByLabel("File type", { exact: true })
        .selectOption("returned");
      await expect(library.locator(".document-item")).toHaveCount(1);
      await library.getByText("Client upload", { exact: true }).waitFor();
      await library
        .getByRole("link", { name: "Open journey stage ↑", exact: true })
        .click();
      await expect(page.locator("#stage-" + fixtureStageId)).toHaveAttribute(
        "open",
        "",
      );
      await library
        .getByRole("button", { name: "Clear filters", exact: true })
        .click();
      if (ownerMode) {
        await library
          .getByLabel("Journey stage", { exact: true })
          .selectOption("project-wide");
        await expect(library.locator(".document-item")).toHaveCount(2);
        await library.getByText("Private draft", { exact: true }).waitFor();
        await library
          .getByText("Shared · access locked", { exact: true })
          .waitFor();
      } else {
        await expect(
          library.getByText("Private agreement.pdf", { exact: true }),
        ).toHaveCount(0);
        await expect(
          library.getByRole("option", { name: "Contracts", exact: true }),
        ).toHaveCount(0);
        await expect(
          library.getByRole("option", {
            name: "Final deliverables",
            exact: true,
          }),
        ).toHaveCount(0);
        await expect(
          library.getByRole("button", {
            name: "Publish to client",
            exact: true,
          }),
        ).toHaveCount(0);
        const invoice = library
          .locator(".document-item")
          .filter({ hasText: "Deposit invoice.pdf" });
        await expect(
          invoice.getByRole("option", {
            name: "Approve this presentation",
            exact: true,
          }),
        ).toHaveCount(0);
      }
      await search.fill("no fictional match");
      await library
        .getByRole("heading", { name: "No matching files", exact: true })
        .waitFor();
      await library
        .getByRole("button", { name: "Show all files", exact: true })
        .click();
      await expect(library.locator(".document-item")).toHaveCount(
        ownerMode ? 5 : 3,
      );
      await captureUi(
        "file-library-" + (ownerMode ? "owner" : "client"),
        library,
      );
      if (ownerMode) {
        await page
          .getByRole("button", { name: /Preview client portal/ })
          .click();
        await expect(
          page
            .getByRole("region", { name: "All project files", exact: true })
            .locator(".document-item"),
        ).toHaveCount(3);
        await expect(
          page
            .getByRole("region", { name: "All project files", exact: true })
            .getByText("Private agreement.pdf", { exact: true }),
        ).toHaveCount(0);
      }
      assert.equal(project.final_paid, false);
      assert.equal(project.final_approved, false);
      assert.deepEqual(errors, []);
      console.log(
        "PASS: searchable, stage-grouped same-record file library, combined filters/reset, journey navigation, owner sharing labels, client/preview filtering and mobile layouts. Fictional services only.",
      );
      return;
    }
    if (dashboardMode) {
      const before = JSON.stringify(finderProjects);
      const insights = page.getByRole("region", {
        name: "Studio insights",
        exact: true,
      });
      const outlook = insights.getByRole("region", {
        name: "Project value outlook",
        exact: true,
      });
      const payment = insights.getByRole("region", {
        name: "Project payment progress",
        exact: true,
      });
      const progress = insights.getByRole("region", {
        name: "Project milestone progress",
        exact: true,
      });
      const pipeline = insights.getByRole("region", {
        name: "Projects by phase",
        exact: true,
      });
      const filter = insights.getByLabel("Show projects", { exact: true });
      const monthPicker = outlook.getByLabel("Inspect month", { exact: true });
      await expect(monthPicker.locator("option")).toHaveCount(6);
      await expect(outlook.locator(".outlook-summary strong")).toHaveText(
        "£11,650.01",
      );
      await expect(outlook).toContainText("1 project outside this period");
      await expect(payment).toContainText("£18,650.01");
      await expect(payment).toContainText("54%");
      await expect(
        progress.locator(".project-progress-rows > button"),
      ).toHaveCount(5);
      await progress
        .getByRole("button", { name: "Show all 6 projects", exact: true })
        .click();
      await expect(
        progress.locator(".project-progress-rows > button"),
      ).toHaveCount(6);
      await expect(progress).not.toContainText("Archived identity");
      await outlook
        .getByLabel("Outlook period", { exact: true })
        .selectOption("12");
      await expect(monthPicker.locator("option")).toHaveCount(12);
      await expect(outlook.locator(".outlook-summary strong")).toHaveText(
        "£18,650.01",
      );
      await monthPicker.selectOption(dashboardMonth(8).slice(0, 7));
      await expect(outlook.locator(".outlook-detail")).toContainText(
        "£7,000.00 project value · £3,500.00 marked received",
      );
      await outlook.locator("summary").click();
      await expect(
        outlook.getByRole("button", { name: /Future identity/ }),
      ).toBeVisible();
      await monthPicker.focus();
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      await expect(monthPicker).toHaveValue(dashboardMonth(11).slice(0, 7));
      await expect(outlook).toContainText(
        "No projects scheduled in this month",
      );
      await expect(outlook.locator(".outlook-detail")).toContainText("£0.00");
      await filter.selectOption("Website Design");
      await expect(payment).toContainText("£2,400.00");
      await expect(payment).toContainText("0%");
      await expect(
        progress.locator(".project-progress-rows > button"),
      ).toHaveCount(1);
      await expect(progress).toContainText("50%");
      await expect(outlook.locator(".outlook-summary strong")).toHaveText(
        "£2,400.00",
      );
      await filter.selectOption("All projects");
      await expect(
        progress.locator(".project-progress-rows > button"),
      ).toHaveCount(5);
      await monthPicker.selectOption(dashboardMonth(2).slice(0, 7));
      await outlook.locator("summary").click();
      await captureUi("overview-dashboard", insights);
      await outlook.getByRole("button", { name: /Brand and website/ }).click();
      await expect(
        page.getByLabel("Select project", { exact: true }),
      ).toHaveValue(combinedFinderId);
      await page.getByRole("button", { name: "Overview", exact: true }).click();
      await progress.getByRole("button", { name: /Motion assets/ }).click();
      await expect(page.locator(".project-summary h2")).toHaveText(
        "Motion assets",
      );
      await page.getByRole("button", { name: "Overview", exact: true }).click();
      await pipeline.getByRole("button", { name: /^Branding/ }).click();
      await expect(
        pipeline.getByRole("button", { name: /Packaging design/ }),
      ).toBeVisible();
      await page.getByRole("button", { name: /Preview client portal/ }).click();
      await expect(insights).toHaveCount(0);
      assert.equal(finderWrites, 0);
      assert.equal(JSON.stringify(finderProjects), before);
      assert.deepEqual(errors, []);
      console.log(
        "PASS: owner area/bar/donut/progress dashboard uses current records, 6/12-month and shared service filters, monthly drill-down and keyboard navigation, project shortcuts, show-all, archive exclusion, no writes, client-preview exclusion and 320/390/1440 layouts. Fictional records only.",
      );
      return;
    }
    if (insightsMode) {
      const insights = page.getByRole("region", {
        name: "Studio insights",
        exact: true,
      });
      await insights
        .getByRole("heading", { name: "Studio at a glance", exact: true })
        .waitFor();
      const pipeline = insights.getByRole("region", {
        name: "Projects by phase",
        exact: true,
      });
      const payment = insights.getByRole("region", {
        name: "Project payment progress",
        exact: true,
      });
      await expect(payment).toContainText("£1,000.00");
      await expect(payment).toContainText("50%");
      await expect(payment.locator("dd").first()).toHaveText("£500.00");
      await expect(payment.locator("dd").last()).toHaveText("£500.00");
      await expect(payment).toContainText(
        "not an invoice balance or bank total",
      );
      const filter = insights.getByLabel("Show projects", { exact: true });
      await filter.selectOption("Website Design");
      await expect(pipeline).toContainText("No projects in this view yet");
      await expect(payment).toContainText("No project value recorded");
      await expect(payment).toContainText("0%");
      await filter.selectOption("All projects");
      const branding = pipeline.getByRole("button", { name: /^Branding/ });
      await branding.click();
      await expect(branding).toHaveAttribute("aria-expanded", "true");
      await expect(
        pipeline.getByRole("button", { name: /Fictional client journey/ }),
      ).toBeVisible();
      await captureUi("overview-charts", page);
      assert.equal(
        await page
          .locator(".workspace-insights")
          .evaluate(
            (el) =>
              !!(
                el.compareDocumentPosition(
                  document.querySelector(".workspace-attention"),
                ) & Node.DOCUMENT_POSITION_FOLLOWING
              ),
          ),
        true,
      );
      await pipeline
        .getByRole("button", { name: /Fictional client journey/ })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Your project journey",
          exact: true,
        }),
      ).toBeVisible();
      await captureUi("branded-owner-project", page);
      await page.getByRole("button", { name: /Preview client portal/ }).click();
      await expect(
        page.getByRole("heading", {
          name: "Your project journey",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Studio insights", exact: true }),
      ).toHaveCount(0);
      await captureUi("branded-client-preview", page);
      assert.equal(project.deposit_paid, true);
      assert.equal(project.final_paid, false);
      assert.deepEqual(errors, []);
      console.log(
        "PASS: branded owner-only charts, consistent service filters, zero-data states, £500/£500 payment split, phase drill-down/project navigation, client-preview exclusion and 320/390/1440 layouts. Fictional records only.",
      );
      return;
    }
    if (workspaceHelpMode) {
      const attention = page.getByRole("region", {
        name: "Needs your attention",
      });
      await attention
        .getByRole("button", { name: /Review returned contract/ })
        .waitFor();
      await captureUi("attention", attention);
      await attention
        .getByRole("button", { name: /Review returned contract/ })
        .click();
      const contract = page
        .locator(".milestone-disclosure")
        .filter({ hasText: "Contract" })
        .first();
      await expect(contract).toHaveAttribute("open", "");
      await contract
        .getByRole("button", { name: "Verify signed contract", exact: true })
        .waitFor();
      assert.equal(project.contract_signed, false);
      assert.equal(project.deposit_paid, false);
      await page
        .getByRole("region", { name: "Project at a glance" })
        .getByText(/Discovery booking area available/)
        .waitFor();
      const goodbye = page
        .locator(".milestone-disclosure")
        .filter({ hasText: "Goodbye Packet" });
      if (!(await goodbye.evaluate((el) => el.open)))
        await goodbye.locator("summary").first().click();
      await goodbye
        .getByRole("link", { name: "Prepare handover & goodbye packet" })
        .click();
      const preparation = page.locator("#handover-preparation");
      await expect(preparation).toHaveAttribute("open", "");
      await preparation.getByText(/Handover notes saved/).waitFor();
      await preparation
        .getByText("Review delivery files (2)", { exact: true })
        .click();
      await expect(preparation).toContainText(
        "1 uploaded · 0 meet the release rules",
      );
      const deliveryFiles = preparation.locator(".delivery-file-list > li");
      await expect(deliveryFiles).toHaveCount(2);
      await expect(
        deliveryFiles.filter({ hasText: "Fictional final files.pdf" }),
      ).toContainText("verify final creative approval");
      await expect(
        deliveryFiles.filter({ hasText: "Goodbye draft.pdf" }),
      ).toContainText("share this private draft");
      await preparation
        .getByRole("link", {
          name: "Review Goodbye draft.pdf in its stage",
          exact: true,
        })
        .click();
      await expect(goodbye).toHaveAttribute("open", "");
      await expect(preparation).toContainText(
        "PDFs and supported images up to 3 MB",
      );
      await preparation
        .locator("summary")
        .filter({ hasText: /Copy a .*goodbye packet outline/ })
        .click();
      const draft = preparation.getByLabel("Goodbye packet draft", {
        exact: true,
      });
      const text = await draft.inputValue();
      assert.match(
        text,
        project.type === "Website Design"
          ? /YOUR FRAMER WEBSITE/
          : /USING YOUR BRAND FILES/,
      );
      if (project.type === "Website Design")
        assert.doesNotMatch(text, /USING YOUR BRAND FILES/);
      await page
        .context()
        .grantPermissions(["clipboard-read", "clipboard-write"]);
      await preparation
        .getByRole("button", { name: "Copy packet outline", exact: true })
        .click();
      await preparation
        .getByRole("button", { name: "Outline copied", exact: true })
        .waitFor();
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        text,
      );
      await captureUi(
        "handover-" + project.type.replaceAll(" ", "-"),
        preparation,
      );
      if (!(await goodbye.evaluate((el) => el.open)))
        await goodbye.locator("summary").first().click();
      await goodbye
        .getByText("Upload my PDF or presentation for this stage", {
          exact: true,
        })
        .click();
      await expect(goodbye.locator('select[name="document_role"]')).toHaveValue(
        "Handover",
      );
      await expect(goodbye.locator('select[name="category"]')).toHaveValue(
        "final",
      );
      assert.equal(project.final_paid, false);
      assert.equal(project.final_approved, false);
      await page.getByRole("button", { name: /Preview client portal/ }).click();
      assert.equal(
        await page
          .getByRole("region", { name: "Needs your attention" })
          .count(),
        0,
      );
      assert.equal(await page.locator("#handover-preparation").count(), 0);
      assert.equal(
        await page.getByLabel("Goodbye packet draft", { exact: true }).count(),
        0,
      );
      assert.deepEqual(errors, []);
      console.log(
        "PASS: actionable owner dashboard, direct stage navigation, correct early-access summary, copyable scoped goodbye draft, final-file defaults and private read-only preview. Fictional services only.",
      );
      return;
    }
    if (invitationsMode) {
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      await page
        .getByRole("button", {
          name: "Invite / manage client access",
          exact: true,
        })
        .click();
      const access = page.getByRole("region", {
        name: "Client portal access for Fictional business",
      });
      await access.getByText("Not invited", { exact: true }).waitFor();
      await access
        .getByRole("button", { name: "Create portal invitation", exact: true })
        .click();
      await access.getByText("Invitation pending", { exact: true }).waitFor();
      await access
        .getByText("2 Jul 2027, 00:30 (UK time)", { exact: true })
        .waitFor();
      await access
        .getByText("9 Jul 2027, 00:30 (UK time)", { exact: true })
        .waitFor();
      await expect(access.locator("time").first()).toHaveAttribute(
        "datetime",
        portalInvitedAt,
      );
      const link = access.getByLabel("Link to send to this client", {
        exact: true,
      });
      await expect(link).toHaveValue(/auth\/confirm\?token_hash=/);
      await page
        .context()
        .grantPermissions(["clipboard-read", "clipboard-write"]);
      await access
        .getByRole("button", { name: "Copy invitation link", exact: true })
        .click();
      await access
        .getByRole("button", { name: "Link copied", exact: true })
        .waitFor();
      assert.equal(
        await page.evaluate(() => navigator.clipboard.readText()),
        await link.inputValue(),
      );
      assert.equal(generatedInvitations, 1);
      await captureUi("client-invitation", access);
      portalState = "expired";
      portalInvitedAt = "2026-10-24T23:30:00.000Z";
      portalExpiresAt = "2026-10-31T23:30:00.000Z";
      await access
        .getByRole("button", { name: "Refresh access status" })
        .click();
      await access.getByText("Invitation expired", { exact: true }).waitFor();
      await expect(link).toHaveCount(0);
      await access
        .getByText("31 Oct 2026, 23:30 (UK time)", { exact: true })
        .waitFor();
      await access
        .getByText(/one-use sign-in link can expire sooner/)
        .waitFor();
      await captureUi("client-invitation-expired", access);
      await access
        .getByRole("button", { name: "Create fresh invitation", exact: true })
        .click();
      await access.getByText("Invitation pending", { exact: true }).waitFor();
      await expect(link).toHaveValue(
        `http://127.0.0.1:${appPort}/login?invited=1`,
      );
      await access.getByText("Remove portal access", { exact: true }).click();
      await access.getByRole("checkbox").check();
      await access
        .getByRole("button", { name: "Remove client access", exact: true })
        .click();
      await access.getByText("Access revoked", { exact: true }).waitFor();
      await expect(link).toHaveCount(0);
      await access
        .getByRole("button", { name: "Create fresh invitation", exact: true })
        .click();
      await access.getByText("Invitation pending", { exact: true }).waitFor();
      await expect(link).toHaveValue(
        `http://127.0.0.1:${appPort}/login?invited=1`,
      );
      assert.equal(generatedInvitations, 1);
      await access
        .getByRole("button", { name: "Refresh access status" })
        .click();
      await expect(link).toHaveCount(0);
      await access.getByText("Invitation pending", { exact: true }).waitFor();
      await access
        .getByRole("button", { name: "Create fresh invitation", exact: true })
        .click();
      await expect(link).toHaveValue(
        `http://127.0.0.1:${appPort}/login?invited=1`,
      );
      portalState = "connected";
      await access
        .getByRole("button", { name: "Refresh access status" })
        .click();
      await access.getByText("Account connected", { exact: true }).waitFor();
      await expect(link).toHaveCount(0);
      await expect(
        access.getByText("Portal permission expires", { exact: true }),
      ).toHaveCount(0);
      await access
        .getByText("4 Jul 2027, 00:30 (UK time)", { exact: true })
        .waitFor();
      await access
        .getByRole("button", { name: "Get portal sign-in link", exact: true })
        .click();
      await expect(link).toHaveValue(`http://127.0.0.1:${appPort}/login`);
      await access
        .getByRole("button", { name: "Copy sign-in link", exact: true })
        .click();
      await access
        .getByRole("button", { name: "Link copied", exact: true })
        .waitFor();
      await access
        .getByRole("button", { name: "Refresh access status" })
        .click();
      await expect(link).toHaveCount(0);
      await access
        .getByRole("button", { name: "Get portal sign-in link", exact: true })
        .click();
      await access
        .getByRole("button", { name: "Copy sign-in link", exact: true })
        .waitFor();
      assert.equal(
        await access
          .getByRole("button", { name: "Create fresh invitation", exact: true })
          .count(),
        0,
      );
      assert.deepEqual(errors, []);
      console.log(
        "PASS: owner project shortcut, copyable private invite, UK creation/expiry/connection dates across BST/GMT from a non-UK browser, expired/revoked/connected states, cleared stale links/copy feedback on refresh and safe reinvitation without another provider token. Fictional services only.",
      );
      return;
    }
    if (accountMode) {
      const requestFreshReset = async () => {
        await page.goto(`http://127.0.0.1:${appPort}/login`);
        await page.getByText("Forgot your password?", { exact: true }).click();
        const resetForm = page.locator("form").filter({
          has: page.getByRole("button", { name: "Send password-reset link" }),
        });
        await resetForm
          .getByLabel("Email address")
          .fill("fictional@example.com");
        await resetForm.getByRole("button").click();
        await resetForm.getByText(/If an account exists/).waitFor();
      };
      await requestFreshReset();
      await page.goto(
        `http://127.0.0.1:${appPort}/auth/callback?code=fictional-reset`,
      );
      await page.waitForURL("**/reset-password");
      await page
        .getByLabel("New password (12 characters minimum)", { exact: true })
        .fill("A-new-fictional-password-123");
      await page
        .getByLabel("Confirm new password", { exact: true })
        .fill("A-different-fictional-password");
      await page
        .getByRole("button", { name: "Save password", exact: true })
        .click();
      await page.getByText(/The passwords do not match/).waitFor();
      assert.equal(passwordUpdates.length, 0);
      await page
        .getByLabel("New password (12 characters minimum)", { exact: true })
        .fill("A-new-fictional-password-123");
      await page
        .getByLabel("Confirm new password", { exact: true })
        .fill("A-new-fictional-password-123");
      await page
        .getByRole("button", { name: "Save password", exact: true })
        .click();
      await page
        .getByText("Your password has been updated.", { exact: true })
        .waitFor();
      assert.equal(passwordUpdates.length, 1);
      assert.equal(passwordUpdates[0].password, "A-new-fictional-password-123");
      assert.equal(Object.hasOwn(passwordUpdates[0], "email"), false);
      await captureUi("password-reset");
      await requestFreshReset();
      await page.goto(
        `http://127.0.0.1:${appPort}/auth/callback?code=fictional-reset&next=https%3A%2F%2Funtrusted.example`,
      );
      await page.waitForURL(`http://127.0.0.1:${appPort}/reset-password`);
      await page.goto(
        `http://127.0.0.1:${appPort}/auth/confirm?token_hash=fictional-private-token-at-least-20`,
      );
      assert.equal(verifiedTypes.length, 0);
      await page
        .getByRole("button", {
          name: "Accept invitation & sign in",
          exact: true,
        })
        .click();
      await page.waitForURL("**/reset-password?welcome=1");
      await page
        .getByRole("heading", {
          name: "Welcome. Let’s set your password.",
          exact: true,
        })
        .waitFor();
      assert.deepEqual(verifiedTypes, ["invite"]);
      await page.goto(
        `http://127.0.0.1:${appPort}/auth/confirm?token_hash=expired-fictional-token-at-least-20&type=recovery`,
      );
      await page
        .getByRole("button", {
          name: "Continue to reset password",
          exact: true,
        })
        .click();
      await page.getByText(/This password-reset link has expired/).waitFor();
      const requestsBeforeHelp = recoveryRequests.length;
      await page
        .getByRole("link", {
          name: "Request a new password-reset link →",
          exact: true,
        })
        .click();
      await page.waitForURL("**/login?help=recovery");
      await page
        .getByRole("button", { name: "Send password-reset link", exact: true })
        .waitFor();
      assert.equal(recoveryRequests.length, requestsBeforeHelp);
      await page.goto(
        `http://127.0.0.1:${appPort}/auth/confirm?token_hash=expired-fictional-token-at-least-20`,
      );
      await page
        .getByRole("button", {
          name: "Accept invitation & sign in",
          exact: true,
        })
        .click();
      await page.getByText(/This invitation has expired/).waitFor();
      await expect(
        page.getByRole("link", {
          name: "Already have an account? Sign in →",
          exact: true,
        }),
      ).toHaveAttribute("href", "/login?invited=1");
      await expect(
        page.getByRole("link", {
          name: "Email Alex about a fresh invitation",
          exact: true,
        }),
      ).toHaveAttribute("href", "mailto:Alex.bell.arts@outlook.com");
      await captureUi("expired-invitation-help");
      const verificationsBeforeIncomplete = verifiedTypes.length;
      await page.goto(`http://127.0.0.1:${appPort}/auth/confirm?type=recovery`);
      await page.getByText(/This password-reset link is incomplete/).waitFor();
      assert.equal(verifiedTypes.length, verificationsBeforeIncomplete);
      await page
        .getByRole("link", {
          name: "Request a new password-reset link →",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Send password-reset link", exact: true })
        .waitFor();
      await page.goto(`http://127.0.0.1:${appPort}/login?help=unrecognised`);
      await expect(page.locator("details.auth-help[open]")).toHaveCount(0);
      assert.equal(passwordUpdates.length, 1);
      assert.deepEqual(errors, []);
      console.log(
        "PASS: password/email sign-in help, authenticated recovery, password confirmation, invitation-to-password setup and expired reset feedback. Fictional services only; no email delivery claimed.",
      );
      return;
    }
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
      const stage = page.locator("#stage-" + fixtureStageId);
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
      const stage = page.locator("#stage-" + fixtureStageId);
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
      if (purposesMode) {
        await stageSettings
          .getByLabel("Milestone name")
          .fill("Agreement review — renamed");
        await stageSettings
          .getByRole("button", { name: "Save milestone", exact: true })
          .click();
        await expect(stage.locator("summary").first()).toContainText(
          "Agreement review — renamed",
        );
        assert.equal(stagePurpose, "contract_deposit");
        assert.equal(project.contract_signed, false);
        assert.equal(project.deposit_paid, false);
        await expect(stage.locator("summary").first()).toContainText(
          "Awaiting verification",
        );
        const purposeSettings = stage.locator("details").filter({
          has: page.locator("summary").filter({ hasText: /^Stage purpose/ }),
        });
        await purposeSettings.locator("summary").first().click();
        for (const purpose of [
          "progress",
          "final_approval",
          "final_payment",
          "contract_deposit",
        ]) {
          await purposeSettings
            .locator('select[name="purpose"]')
            .selectOption(purpose);
          await purposeSettings.getByRole("checkbox").check();
          await purposeSettings
            .getByRole("button", { name: "Save stage purpose", exact: true })
            .click();
          await expect(purposeSettings.getByRole("checkbox")).not.toBeChecked();
          assert.equal(stagePurpose, purpose);
          assert.equal(project.contract_signed, false);
          assert.equal(project.deposit_paid, false);
          assert.equal(project.final_paid, false);
          assert.equal(project.final_approved, false);
          await expect(focus).toContainText(
            "Locked — needs signed contract and deposit payment",
          );
          if (purpose === "progress")
            await expect(stage.locator(".journey-verification")).toHaveCount(0);
          if (purpose === "final_approval")
            await expect(
              stage.getByRole("button", {
                name: "Verify final approval",
                exact: true,
              }),
            ).toBeVisible();
          if (purpose === "final_payment")
            await expect(
              stage.getByRole("button", {
                name: "Verify final payment",
                exact: true,
              }),
            ).toBeVisible();
        }
        await purposeSettings.locator("summary").first().click();
      }
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
      assert.equal(
        await page
          .getByRole("link", { name: "Privacy & cookies", exact: true })
          .getAttribute("href"),
        "/privacy",
      );
      await page.getByRole("button", { name: /Preview client portal/ }).click();
      await page
        .getByRole("heading", {
          name: "Everything for your project",
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page
          .getByRole("link", { name: "Privacy & cookies", exact: true })
          .getAttribute("href"),
        "/privacy",
      );
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
          name: "Disguised asset.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("<html>This is not a PDF</html>"),
        });
      await page
        .getByRole("button", { name: "Upload asset privately", exact: true })
        .click();
      await page
        .getByText("The file contents do not match its file type.", {
          exact: true,
        })
        .waitFor();
      assert.equal(
        assets.length,
        0,
        "rejected bytes must not create asset records",
      );
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
  } catch (error) {
    const failedPage = browser?.contexts()[0]?.pages()[0];
    if (failedPage)
      console.error(
        (await failedPage.locator("body").innerText()).slice(-9000),
      );
    if (errors.length) console.error(errors);
    throw error;
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
