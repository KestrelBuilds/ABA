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
    const privacyResponse = await page.goto("http://127.0.0.1:3000/privacy");
    assert.equal(privacyResponse.status(), 200);
    assert.equal(privacyResponse.headers()["set-cookie"], undefined);
    await page
      .getByRole("heading", { name: "Privacy & cookies.", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("link", { name: "Alex.bell.arts@outlook.com", exact: true })
        .getAttribute("href"),
      "mailto:Alex.bell.arts@outlook.com",
    );
    await page
      .getByRole("link", { name: "Cookies & browser storage", exact: true })
      .click();
    await page.waitForURL("**/privacy#cookies");
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    await page
      .getByRole("link", { name: "Return to sign in", exact: true })
      .click();
    await page.waitForURL("**/login");
    assert.equal(await page.locator('a[href="/demo"]').count(), 0);
    await page
      .getByRole("link", { name: "Privacy & cookies", exact: true })
      .click();
    await page.waitForURL("**/privacy");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://127.0.0.1:3000");
    await page
      .getByRole("heading", { name: "Your vision. My creative direction." })
      .waitFor();
    assert.equal(await page.locator('a[href="/demo"]').count(), 0);
    assert.match(
      await page.locator("body").innerText(),
      /Access is by invitation/,
    );
    assert.doesNotMatch(
      await page.locator("body").innerText(),
      /Development version|fictional demonstration/i,
    );
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: `/tmp/aba-portal-welcome-${width}.png`,
        fullPage: true,
      });
    }
    await page.getByRole("link", { name: "Open my workspace" }).click();
    await page.waitForURL("**/login");
    await page
      .getByText(
        "Secure sign-in is not connected yet. No client accounts are available.",
      )
      .waitFor();
    assert.equal(await page.getByLabel("Password", { exact: true }).count(), 0);
    await page.goto("http://127.0.0.1:3000/reset-password");
    await page.waitForURL("**/login");
    await page.goto("http://127.0.0.1:3000/access");
    await page.waitForURL("**/login");
    await page.goto("http://127.0.0.1:3000/welcome");
    await page.waitForURL("**/login");
    await page.goto("http://127.0.0.1:3000/contracts");
    await page.waitForURL("**/login");
    await page.goto("http://127.0.0.1:3000/workspace");
    await page.waitForURL("**/login");
    await page.getByRole("link", { name: "Connection setup" }).click();
    await page
      .getByRole("heading", { name: "A home for your projects." })
      .waitFor();
    assert.equal(await page.locator('a[href="/demo"]').count(), 0);
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
      "PASS: public privacy/cookie notice, contact link, sign-in footer navigation, 320/390/1440px privacy layouts, home navigation, missing-connection explanation, protected admin/client redirects, unauthenticated file denial, invalid invitation handling, mobile layout. Hosted sign-in/storage not tested.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
