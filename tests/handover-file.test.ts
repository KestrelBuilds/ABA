import { test } from "node:test";
import assert from "node:assert/strict";
import { validateHandoverFile, inspectSvg } from "../lib/handover-file";
test("owner AI handovers accept PDF-compatible and PostScript Illustrator exports and canonicalise browser MIME variants", async () => {
  for (const [contents, type] of [
    ["%PDF-1.7 fictional", "application/pdf"],
    ["%!PS-Adobe-3.0 fictional", "application/postscript"],
    ["%PDF-1.7 fictional", ""],
  ])
    assert.equal(
      await validateHandoverFile(new File([contents], "Logo.ai", { type })),
      "application/postscript",
    );
  await assert.rejects(() =>
    validateHandoverFile(
      new File(["script"], "Logo.ai", { type: "application/postscript" }),
    ),
  );
  await assert.rejects(() =>
    validateHandoverFile(
      new File([new Uint8Array(3 * 1024 * 1024 + 1)], "Logo.ai"),
    ),
  );
});
test("SVG handovers parse static drawings and reject malformed, active or external-resource content", async () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 10" fill="#111"/></svg>';
  assert.equal(
    await validateHandoverFile(
      new File([svg], "Logo.svg", { type: "image/svg+xml" }),
    ),
    "image/svg+xml",
  );
  inspectSvg(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="a"/></defs><path fill="url(#a)" d="M0 0L1 1"/></svg>',
    ),
  );
  for (const content of [
    "<svg/>",
    '<svg xmlns="http://www.w3.org/2000/svg">',
    '<!DOCTYPE svg [<!ENTITY x "bad">]>' + svg,
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/private"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>@import "https://example.com/style";</style></svg>',
  ])
    assert.throws(() => inspectSvg(Buffer.from(content)));
});
