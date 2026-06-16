/**
 * Money helpers. All accounting comparisons are done in integer cents (poisha)
 * so floating point can never break the debit == credit invariant.
 */
export const toCents = (amount: number): number => Math.round(Number(amount) * 100);
export const fromCents = (cents: number): number => Math.round(cents) / 100;
export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const sumCents = (amounts: number[]): number =>
  amounts.reduce((acc, a) => acc + toCents(a), 0);
