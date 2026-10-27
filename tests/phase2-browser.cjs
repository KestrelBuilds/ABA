const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:3000");
    await page
      .getByRole("heading", { name: "A considered space for good things." })
      .waitFor();
    await page.getByRole("link", { name: "Open my workspace" }).click();
    await page.waitForURL("**/login");
    await page
      .getByText(
        "Secure sign-in is not connected yet. No client accounts are available.",
      )
      .waitFor();
    assert.equal(await page.getByLabel("Password", { exact: true }).count(), 0);
    await page.goto("http://127.0.0.1:3000/workspace");
    await page.waitForURL("**/login");
    await page.getByRole("link", { name: "Connection setup" }).click();
    await page
      .getByRole("heading", { name: "A home for your projects." })
      .waitFor();
    await page.screenshot({
      path: "/tmp/aba-phase2-setup.png",
      fullPage: true,
    });
    const response = await page.request.get(
      "http://127.0.0.1:3000/files/30000000-0000-4000-8000-000000000001",
    );
    assert.equal(response.status(), 403);
    const exportResponse = await page.request.get(
      "http://127.0.0.1:3000/account/export",
    );
    assert.equal(exportResponse.status(), 403);
    assert.match(exportResponse.headers()["cache-control"], /no-store/);
    await page.goto("http://127.0.0.1:3000/account-security");
    await page.waitForURL("**/login");
    await page.goto("http://127.0.0.1:3000/auth/confirm");
    await page
      .getByText(
        "This invitation is incomplete. Please ask Alex for a fresh link.",
      )
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Accept invitation & sign in" })
        .count(),
      0,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: home navigation, missing-connection explanation, protected admin/client redirects, unauthenticated file denial, invalid invitation handling, mobile layout. Hosted sign-in/storage not tested.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
