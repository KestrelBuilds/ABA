// Real Next.js pages/actions in Chromium, with an isolated fictional Supabase HTTP
// fixture. This tests UI integration, not hosted provider security or email delivery.
const { createServer } = require("node:http");
const { spawn } = require("node:child_process");
const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fixturePort = 35431,
  appPort = 35432;
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
const errors = [];
let browser, app;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${fixturePort}`);
    const path = url.pathname;
    let text = "";
    for await (const chunk of req) text += chunk;
    const body = text ? JSON.parse(text) : {};
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
    const table = path.split("/").pop();
    let rows = [];
    if (table === "profiles")
      rows = [{ id: uid, role: "client", client_id: cid }];
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
    if (table === "projects") rows = [project];
    if (table === "stages")
      rows = [
        {
          id: randomUUID(),
          project_id: pid,
          name: "Concept review",
          stream: "Brand Identity",
          position: 0,
          status: "Awaiting Client",
          visible: true,
        },
      ];
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
    await page
      .getByRole("heading", { name: "Fictional client journey", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByText("Fictional final files.pdf", { exact: true })
        .count(),
      0,
    );
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
