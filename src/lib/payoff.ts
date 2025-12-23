import { DebtAccount } from "./types";

export type Strategy = "avalanche" | "snowball";

export interface PayoffRecommendation {
  ordered: DebtAccount[];
  note: string;
}

export function sortDebts(debts: DebtAccount[], strategy: Strategy = "avalanche"): PayoffRecommendation {
  const activeDebts = debts.filter((d) => d.active !== false);
  const ordered =
    strategy === "avalanche"
      ? [...activeDebts].sort((a, b) => (b.apr ?? 0) - (a.apr ?? 0))
      : [...activeDebts].sort((a, b) => a.balance - b.balance);
  const note =
    strategy === "avalanche"
      ? "Avalanche: highest APR first, pay minimums on the rest."
      : "Snowball: smallest balance first for faster wins.";
  return { ordered, note };
}

export function projectPayoff(
  debts: DebtAccount[],
  extraPerMonth: number,
  strategy: Strategy = "avalanche"
): { months: number; ordered: DebtAccount[] } {
  // Simplified payoff estimation assuming minimums + extra applied to target debt
  const { ordered } = sortDebts(debts, strategy);
  let months = 0;
  const working = ordered.map((d) => ({ ...d }));

  // Avoid infinite loops when no payments set
  const minSum = working.reduce((sum, d) => sum + (d.minPayment ?? 0), 0);
  if (minSum + extraPerMonth <= 0) {
    return { months: 0, ordered };
  }

  // Very rough snowball/avalanche simulation
  while (working.some((d) => d.balance > 0) && months < 360) {
    months += 1;
    for (let i = 0; i < working.length; i++) {
      const debt = working[i];
      if (debt.balance <= 0) continue;
      const minPayment = debt.minPayment ?? 0;
      const interest = debt.apr ? (debt.apr / 12 / 100) * debt.balance : 0;
      debt.balance = Math.max(0, debt.balance + interest - minPayment);
      if (i === 0) {
        debt.balance = Math.max(0, debt.balance - extraPerMonth);
      }
    }
    // Resort after each cycle in case balances drop to zero (for snowball)
    working.sort((a, b) =>
      strategy === "avalanche" ? (b.apr ?? 0) - (a.apr ?? 0) : a.balance - b.balance
    );
  }

  return { months, ordered: working };
}
