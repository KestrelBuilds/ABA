const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3000/demo");
  await page
    .getByRole("heading", { name: "Good things take shape." })
    .waitFor();
  await page
    .getByRole("button", { name: /An identity with intention/ })
    .first()
    .waitFor();
  await page.screenshot({ path: "/tmp/aba-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Project name").fill("Combined demo launch");
  await page.getByLabel("Project workflow").selectOption("Both");
  await page.getByLabel("Estimated completion").fill("2027-01-20");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByRole("heading", { name: "Combined demo launch" }).waitFor();
  assert.equal(await page.getByLabel(/^Stage name /).count(), 25);
  await page
    .getByLabel("Status for Enquiry", { exact: true })
    .selectOption("Completed");
  await page.reload();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: /Combined demo launch/ }).click();
  assert.equal(
    await page.getByLabel("Status for Enquiry", { exact: true }).inputValue(),
    "Completed",
  );
  await page
    .getByRole("button", { name: "Preview this client’s portal" })
    .click();
  await page
    .getByRole("heading", { name: "Your project is getting ready" })
    .waitFor();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: /A fresh digital home/ }).click();
  await page
    .getByRole("button", { name: "Preview this client’s portal" })
    .click();
  await page.getByRole("heading", { name: "Your project journey" }).waitFor();
  assert.equal(
    await page
      .getByRole("link", { name: "AI Logo Direction Exercise" })
      .count(),
    0,
  );
  assert.equal(
    await page.getByText("Framer build; content supplied by client.").count(),
    0,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/aba-mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Clients", exact: true }).click();
  await page.getByRole("button", { name: "New client", exact: true }).click();
  await page.getByLabel("Business name").fill("Test Studio");
  await page.getByLabel("Contact name").fill("Demo Person");
  await page.getByLabel("Email address").fill("demo@example.com");
  await page.getByLabel("Business sector").fill("Creative");
  await page
    .getByRole("button", { name: "Create client", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Test Studio", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: combined creation, 25 milestones, status persistence, onboarding gate, website-only portal, private-note exclusion, mobile overflow, client creation; no browser exceptions.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
