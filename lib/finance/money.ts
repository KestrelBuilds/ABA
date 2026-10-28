export function splitPayment(totalPence: number) {
  if (!Number.isSafeInteger(totalPence) || totalPence < 0)
    throw Error("Use a non-negative whole number of pence.");
  const deposit = Math.ceil(totalPence / 2);
  return { deposit, final: totalPence - deposit };
}
export function pounds(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}
export function financeTotals(
  invoices: { status: string; amount_pence: number; paid_on: string | null }[],
  month: string,
) {
  return invoices.reduce(
    (a, i) => {
      if (i.status === "Issued") a.outstanding += Number(i.amount_pence);
      if (i.status === "Paid") {
        a.received += Number(i.amount_pence);
        if (i.paid_on?.startsWith(month)) a.monthly += Number(i.amount_pence);
      }
      return a;
    },
    { outstanding: 0, received: 0, monthly: 0 },
  );
}
