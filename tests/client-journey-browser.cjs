// Real Next.js pages/actions in Chromium, with an isolated fictional Supabase HTTP
// fixture. This tests UI integration, not hosted provider security or email delivery.
const { createServer } = require("node:http");
const { spawn } = require("node:child_process");
const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fixturePort = 35431,
  appPort = 35432;
const verificationMode = process.argv.includes("--verification");
const managementMode = process.argv.includes("--management");
const stageMode = process.argv.includes("--stages");
const fixtureStageId = randomUUID();
const financeMode = process.argv.includes("--finance");
const ownerMode =
  process.argv.includes("--owner-preview") || financeMode || verificationMode;
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
if (verificationMode) {
  project.contract_signed = false;
  project.deposit_paid = false;
}
if (financeMode) {
  project.deposit_paid = false;
  project.final_paid = false;
}
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
      return res.end("%PDF-1.4\nFictional test bytes\n%%EOF");
    }
    if (
      path.startsWith("/storage/v1/object/client-assets/") &&
      req.method === "POST"
    )
      return json({ Key: path.split("/object/")[1], Id: randomUUID() });
    const table = path.split("/").pop();
    if (table === "business_documents_ready")
      return json(financeMode || stageMode);
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
    if (table === "record_invoice_payment") {
      const i = financeInvoices.find((i) => i.id === body.target);
      i.status = "Paid";
      i.paid_on = body.payment_date;
      project.deposit_paid = true;
      return json(null);
    }
    if (table === "project_management_ready")
      return json(managementMode || stageMode);
    if (table === "complete_client_action") {
      const a = clientActions.find((a) => a.id === body.target);
      if (a) a.status = body.done ? "Done" : "To do";
      return json(null);
    }

    let rows = [];
    if (table === "profiles")
      rows = [
        {
          id: uid,
          role: ownerMode ? "admin" : "client",
          client_id: ownerMode ? null : cid,
        },
      ];
    if (table === "clients")
      rows = [
        {
          id: cid,
          name: "Fictional business",
          contact: "Jamie Example",
          email: user.email,
          sector: "Design",
        },
      ];
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
          name: verificationMode
            ? "Contract and Deposit"
            : stageMode
              ? "Discovery Call"
              : "Concept review",
          stream: verificationMode ? "Onboarding" : "Brand Identity",
          position: 0,
          status: verificationMode ? "Completed" : "Awaiting Client",
          visible: true,
        },
      ];
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
    if (verificationMode) {
      await page
        .getByRole("heading", { name: "ABA Owner Dashboard", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      const stage = page
        .locator(".milestone-disclosure")
        .filter({ hasText: "Contract and Deposit" });
      await stage.locator("summary").first().click();
      assert.match(
        await stage.locator("summary").first().innerText(),
        /Awaiting verification/,
      );
      assert.equal(
        await stage.locator('select[name="status"]').isDisabled(),
        true,
      );
      const stageFile = stage.locator(".file-visibility").first();
      const libraryFile = page
        .locator(".document-item .file-visibility")
        .first();
      assert.match(
        await stageFile.innerText(),
        /verify the signed contract; verify the deposit payment/,
      );
      assert.equal(await stageFile.innerText(), await libraryFile.innerText());
      const confirmations = stage.locator(".journey-verification form");
      await confirmations.nth(0).getByRole("checkbox").check();
      await confirmations
        .nth(0)
        .getByRole("button", { name: "Confirm verified record" })
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
        .getByRole("button", { name: "Confirm verified record" })
        .click();
      await page.waitForFunction(() =>
        document
          .querySelector(".milestone-disclosure summary")
          ?.textContent.includes("Completed"),
      );
      assert.equal(project.deposit_paid, true);
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
      await page.getByRole("button", { name: "Finance", exact: true }).click();
      await page
        .getByRole("heading", { name: "Invoice ledger", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Projects", exact: true }).click();
      await page
        .getByText("Optional built-in proposals & invoices", { exact: true })
        .click();
      const business = page.locator("#business-documents");
      await business
        .getByRole("button", { name: "Create draft proposal", exact: true })
        .click();
      const proposal = business
        .locator(".business-record")
        .filter({ hasText: "Proposal · revision 1" });
      await proposal.getByText("Edit draft", { exact: true }).click();
      for (const label of [
        "Scope",
        "Deliverables",
        "Timeline",
        "Revision allowance",
        "Outside scope",
        "Additional notes",
      ])
        await proposal
          .getByLabel(label, { exact: true })
          .fill("Fictional " + label + " terms.");
      await proposal
        .getByRole("button", { name: "Save draft", exact: true })
        .click();
      await proposal
        .locator(".brief-field p")
        .filter({ hasText: "Fictional Scope terms." })
        .waitFor();
      await proposal
        .getByRole("button", {
          name: "Share this revision with client",
          exact: true,
        })
        .click();
      await proposal.getByText("Shared", { exact: true }).waitFor();
      const pdf = await page.request.get(
        new URL(
          await proposal
            .getByRole("link", { name: /proposal PDF/ })
            .getAttribute("href"),
          page.url(),
        ).href,
      );
      assert.equal(pdf.status(), 200);
      assert.match(pdf.headers()["content-type"], /application\/pdf/);
      assert.ok((await pdf.body()).subarray(0, 4).equals(Buffer.from("%PDF")));
      const invoice = business
        .locator(".business-record")
        .filter({ hasText: "Deposit invoice" });
      await invoice.getByLabel("Due date", { exact: true }).fill("2027-02-01");
      await invoice
        .getByRole("button", { name: "Issue invoice", exact: true })
        .click();
      await invoice.getByText("Issued", { exact: true }).waitFor();
      await invoice.locator('input[name="confirmed"]').check();
      await invoice
        .getByRole("button", { name: "Record full payment", exact: true })
        .click();
      await invoice.getByText("Paid", { exact: true }).waitFor();
      assert.equal(financeInvoices[0].status, "Paid");
      assert.equal(project.deposit_paid, true);
      assert.deepEqual(errors, []);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      console.log(
        "PASS: actual finance UI draft creation/edit/share, protected proposal PDF download, invoice issue and verified full-payment recording, using fictional HTTP services.",
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
