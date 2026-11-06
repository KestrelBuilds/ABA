import { test } from "node:test";
import assert from "node:assert/strict";
import { taxReserve } from "../lib/tax-reserve";

test("a chosen percentage reserves from estimated profit, not the whole project income", () => {
  assert.deepEqual(taxReserve("1000", "200", "30"), {
    ok: true,
    income: 100000,
    costs: 20000,
    profit: 80000,
    reserve: 24000,
    balance: 56000,
    percentage: 30,
  });
  assert.equal(
    taxReserve("1000", "0", "").ok,
    false,
    "no statutory or default rate is invented",
  );
});

test("reserve arithmetic preserves pennies, rounds once and handles chosen zero/100 percent rates", () => {
  for (const [income, costs, percentage, expected] of [
    ["0.29", "0", "100", 29],
    ["0.05", "0", "10", 1],
    ["100.01", "0.01", "12.50", 1250],
    ["1000", "100", "0", 0],
    ["10000000", "0", "100", 1000000000],
  ] as const) {
    const result = taxReserve(income, costs, percentage);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.reserve, expected);
      assert.equal(result.reserve + result.balance, result.profit);
    }
  }
});

test("zero profit and project losses create no negative reserve or claimed tax refund", () => {
  for (const costs of ["1000", "1200"]) {
    const result = taxReserve("1000", costs, "30");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.reserve, 0);
      assert.equal(result.balance, 100000 - Number(costs) * 100);
    }
  }
});

test("invalid money, percentages, non-finite/exponential and excessive inputs are rejected", () => {
  for (const value of [
    "",
    "-1",
    "1e4",
    "NaN",
    "Infinity",
    "1.001",
    "1,000",
    "10000001",
    "9".repeat(50),
  ]) {
    assert.equal(taxReserve(value, "0", "30").ok, false);
    assert.equal(taxReserve("1000", value, "30").ok, false);
  }
  for (const value of ["-1", "100.01", "20.001", "1e2", " ", "Infinity"])
    assert.equal(taxReserve("1000", "0", value).ok, false);
});
