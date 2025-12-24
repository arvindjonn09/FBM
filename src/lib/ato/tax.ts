export type Bracket = { upTo: number; rate: number; base: number };

// Resident 2023-24 style
export const residentBrackets: Bracket[] = [
  { upTo: 18200, rate: 0, base: 0 },
  { upTo: 45000, rate: 0.19, base: 0 },
  { upTo: 120000, rate: 0.325, base: 5092 },
  { upTo: 180000, rate: 0.37, base: 29467 },
  { upTo: Infinity, rate: 0.45, base: 51667 }
];

export function incomeTaxResident(taxable: number, brackets: Bracket[] = residentBrackets) {
  let last = 0;
  for (const b of brackets) {
    if (taxable <= b.upTo) {
      return b.base + (taxable - last) * b.rate;
    }
    last = b.upTo;
  }
  return 0;
}

export function medicareLevy(taxable: number) {
  return taxable * 0.02;
}
