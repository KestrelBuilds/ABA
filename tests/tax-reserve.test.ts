import { test } from "node:test";
import assert from "node:assert/strict";
import { taxReserve } from "../lib/tax-reserve";

test("the owner-chosen reserve is 20% of the full project value in pence", () => {
  assert.equal(taxReserve(1000), 20000);
  assert.equal(taxReserve(2400), 48000);
  assert.equal(taxReserve(0), 0);
});

test("project reserves round to whole pennies from the saved monetary value", () => {
  assert.equal(taxReserve(0.02), 0);
  assert.equal(taxReserve(0.03), 1);
  assert.equal(taxReserve(100.03), 2001);
  assert.equal(taxReserve(0.29), 6);
});
