// Planning arithmetic only: no statutory rates or calculation of tax owed.
function hundredths(value: string, maximum: number) {
  const text = value.trim();
  if (text.length > 24 || !/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > maximum) return null;
  return amount;
}

export function taxReserve(income: string, costs: string, percentage: string) {
  const incomePence = hundredths(income, 1_000_000_000);
  const costsPence = hundredths(costs, 1_000_000_000);
  const basisPoints = hundredths(percentage, 10_000);
  if (incomePence === null || costsPence === null)
    return {
      ok: false as const,
      message:
        "Enter income and costs from £0 to £10,000,000, with up to two decimal places.",
    };
  if (basisPoints === null)
    return {
      ok: false as const,
      message: percentage.trim()
        ? "Enter a planning percentage from 0 to 100, with up to two decimal places."
        : "Choose your planning percentage to see a reserve.",
    };
  const profit = incomePence - costsPence;
  const reserve = Math.round((Math.max(0, profit) * basisPoints) / 10_000);
  return {
    ok: true as const,
    income: incomePence,
    costs: costsPence,
    profit,
    reserve,
    balance: profit - reserve,
    percentage: basisPoints / 100,
  };
}
