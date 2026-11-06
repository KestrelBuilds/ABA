// Owner-chosen planning rule: 20% of the saved project value, returned in pence.
// This is not a calculation of tax owed.
export function taxReserve(projectValue: number) {
  return Math.round(Math.round(projectValue * 100) / 5);
}
