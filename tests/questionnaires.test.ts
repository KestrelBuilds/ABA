import { test } from "node:test";
import assert from "node:assert/strict";
import { prompts, requireCompleteAnswers } from "../lib/questionnaires";
test("questionnaires require the exact questions for their workstream", () => {
  const answers = Object.fromEntries(
    prompts.brand.map(([key]) => [key, "A fictional answer"]),
  );
  assert.doesNotThrow(() => requireCompleteAnswers("brand", answers));
  assert.throws(() => requireCompleteAnswers("website", answers));
  assert.throws(() =>
    requireCompleteAnswers("brand", {
      ...answers,
      extra: "Unexpected question",
    }),
  );
});
test("blank or missing answers cannot be submitted as a complete questionnaire", () => {
  assert.throws(() => requireCompleteAnswers("goodbye", {}));
  assert.throws(() =>
    requireCompleteAnswers("brand", {
      business: "Test",
      audience: "   ",
      direction: "Clear",
    }),
  );
});

test("combined projects ask shared business questions once while website-only projects retain them", async () => {
  const { questionnairePrompts } = await import("../lib/questionnaires");
  const brand = questionnairePrompts("brand", "Both");
  const website = questionnairePrompts("website", "Both");
  assert.ok(brand.some(([key]) => key === "business"));
  assert.ok(!website.some(([key]) => key === "business"));
  assert.ok(
    questionnairePrompts("website", "Website Design").some(
      ([key]) => key === "business",
    ),
  );
  assert.equal(brand.length, 9);
  assert.equal(website.length, 5);
});

test("the Notion branding reference question remains optional", () => {
  const answers = Object.fromEntries(
    prompts.brand
      .filter(([key]) => key !== "direction")
      .map(([key]) => [key, "Fictional answer"]),
  );
  assert.doesNotThrow(() => requireCompleteAnswers("brand", answers));
});
