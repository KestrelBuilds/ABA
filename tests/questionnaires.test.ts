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
