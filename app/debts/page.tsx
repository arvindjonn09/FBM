"use client";

import { useMemo, useState } from "react";
import type { DebtAccount } from "../../src/lib/types";
import { sortDebts } from "../../src/lib/payoff";

type LoanInput = {
  name: string;
  balance: number;
  apr: number;
  termMonths: number;
  payment: number;
};

const defaultDebts: DebtAccount[] = [];

const calcEmi = (principal: number, apr: number, months: number) => {
  if (months <= 0) return 0;
  const r = apr > 0 ? apr / 12 / 100 : 0;
  if (r === 0) return principal / months;
  const num = principal * r * Math.pow(1 + r, months);
  const den = Math.pow(1 + r, months) - 1;
  return num / den;
};

const estimateAprFromPayment = (principal: number, payment: number, months: number) => {
  if (principal <= 0 || payment <= 0 || months <= 0) return 0;
  const minPayment = principal / months;
  if (payment <= minPayment) return 0;
  let low = 0;
  let high = 1; // monthly rate upper bound (100%/mo)
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    const num = principal * mid * Math.pow(1 + mid, months);
    const den = Math.pow(1 + mid, months) - 1;
    const guess = num / den;
    if (guess > payment) {
      high = mid;
    } else {
      low = mid;
    }
  }
  const monthlyRate = (low + high) / 2;
  return monthlyRate * 12 * 100; // APR %
};

const payoffWithExtra = (debts: DebtAccount[], extra: number) => {
  // Apply extra to highest APR (avalanche) for speed
  const ordered = [...debts].sort((a, b) => (b.apr ?? 0) - (a.apr ?? 0));
  const clones = ordered.map((d) => ({ ...d, balance: d.balance, payment: d.minPayment ?? calcEmi(d.balance, d.apr ?? 0, 12) }));
  let months = 0;
  let interestPaid = 0;
  while (clones.some((d) => d.balance > 0) && months < 480) {
    months += 1;
    for (let i = 0; i < clones.length; i++) {
      const debt = clones[i];
      if (debt.balance <= 0) continue;
      const r = debt.apr ? debt.apr / 12 / 100 : 0;
      const interest = debt.balance * r;
      interestPaid += interest;
      const base = debt.payment ?? 0;
      const extraPay = i === 0 ? extra : 0;
      const pay = Math.max(0, base + extraPay);
      debt.balance = Math.max(0, debt.balance + interest - pay);
    }
  }
  return { months, interestPaid };
};

export default function DebtsPage() {
  const [debts, setDebts] = useState<DebtAccount[]>(defaultDebts);
  const [form, setForm] = useState<LoanInput>({ name: "", balance: 0, apr: 0, termMonths: 12, payment: 0 });
  const [extra, setExtra] = useState(20);

  const totals = useMemo(() => {
    const totalBalance = debts.reduce((s, d) => s + d.balance, 0);
    const totalMin = debts.reduce((s, d) => s + (d.minPayment ?? 0), 0);
    const avgApr =
      debts.length === 0 ? 0 : debts.reduce((s, d) => s + (d.apr ?? 0), 0) / debts.length;
    return { totalBalance, totalMin, avgApr };
  }, [debts]);

  const avalanche = useMemo(() => sortDebts(debts, "avalanche"), [debts]);
  const snowball = useMemo(() => sortDebts(debts, "snowball"), [debts]);

  const handleAdd = () => {
    if (!form.name || form.balance <= 0 || form.termMonths <= 0) return;
    const inferredApr = form.apr > 0 ? form.apr : estimateAprFromPayment(form.balance, form.payment, form.termMonths);
    const emi =
      form.payment > 0 ? form.payment : calcEmi(form.balance, inferredApr, form.termMonths);
    const next: DebtAccount = {
      id: Date.now(),
      name: form.name,
      balance: form.balance,
      apr: inferredApr,
      minPayment: Math.round(emi),
      dueDay: undefined,
      active: true
    };
    setDebts((prev) => [...prev, next]);
    setForm({ name: "", balance: 0, apr: 0, termMonths: 12, payment: 0 });
  };

  const extraProjection = useMemo(() => payoffWithExtra(debts, extra), [debts, extra]);

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-slate-400">Debt accounts</p>
        <h1 className="text-2xl font-semibold">Loans, APRs, EMIs, and payoff ideas</h1>
      </header>

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-sm text-slate-400">Total debt</p>
          <p className="text-2xl font-semibold text-rose-200">${totals.totalBalance.toFixed(0)}</p>
          <p className="text-xs text-slate-400 mt-1">Sum of balances across all loans</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-400">Monthly obligations</p>
          <p className="text-2xl font-semibold text-emerald-200">${totals.totalMin.toFixed(0)}</p>
          <p className="text-xs text-slate-400 mt-1">Minimums/EMIs across all debts</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-400">Average APR</p>
          <p className="text-2xl font-semibold text-amber-200">{totals.avgApr.toFixed(1)}%</p>
          <p className="text-xs text-slate-400 mt-1">Higher = prioritize with avalanche</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-400">Extra payment test</p>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={10}
              max={30}
              step={5}
              value={extra}
              onChange={(e) => setExtra(Number(e.target.value))}
              className="w-full accent-emerald-400"
            />
            <span className="text-sm text-slate-200">${extra}</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Apply to highest APR: projected payoff ~{extraProjection.months} months; interest paid ~$
            {extraProjection.interestPaid.toFixed(0)} (rough).
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {debts.length === 0 ? (
          <div className="card p-4 text-sm text-slate-300">
            No debts added yet. Use the loan/EMI calculator below to add your first entry.
          </div>
        ) : (
          debts.map((debt) => (
            <div key={debt.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{debt.name}</h3>
                <span className="text-sm text-slate-400">Due day {debt.dueDay ?? "-"}</span>
              </div>
              <div className="text-sm text-slate-300">Balance: ${debt.balance.toFixed(0)}</div>
              <div className="text-sm text-slate-300">APR: {debt.apr ? `${debt.apr}%` : "n/a"}</div>
              <div className="text-sm text-slate-300">Min/EMI: ${debt.minPayment?.toFixed(0) ?? "0"}</div>
              <p className="text-xs text-slate-400">
                Paying ${extra} extra/month to this account shortens payoff further (avalanche picks highest APR first).
              </p>
            </div>
          ))
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="text-lg font-semibold mb-2">Add loan / EMI calculator</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="col-span-2 text-slate-300">
              Name
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g., Home loan, VISA, Personal loan"
              />
            </label>
            <label className="text-slate-300">
              Balance
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                value={form.balance}
                onChange={(e) => setForm((p) => ({ ...p, balance: Number(e.target.value) }))}
              />
            </label>
            <label className="text-slate-300">
              APR (%)
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                value={form.apr}
                onChange={(e) => setForm((p) => ({ ...p, apr: Number(e.target.value) }))}
                placeholder="Enter if known"
              />
            </label>
            <label className="text-slate-300">
              Payment / month (optional)
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                value={form.payment}
                onChange={(e) => setForm((p) => ({ ...p, payment: Number(e.target.value) }))}
                placeholder="Helps estimate APR"
              />
            </label>
            <label className="text-slate-300">
              Term (months)
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                value={form.termMonths}
                onChange={(e) => setForm((p) => ({ ...p, termMonths: Number(e.target.value) }))}
                min={1}
              />
            </label>
            <div className="text-slate-300 text-sm">
              <p>Calculated EMI</p>
              <p className="mt-1 text-xl font-semibold text-emerald-200">
                ${calcEmi(form.balance, form.apr || estimateAprFromPayment(form.balance, form.payment, form.termMonths), form.termMonths).toFixed(0)}
              </p>
              <p className="text-xs text-slate-400">
                0% APR uses straight balance ÷ months. Enter monthly payment to estimate APR if you don't know it.
              </p>
              {form.payment > 0 && (
                <p className="text-xs text-amber-200">
                  Estimated APR from payment:{" "}
                  {estimateAprFromPayment(form.balance, form.payment, form.termMonths).toFixed(2)}%
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleAdd}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
            >
              Add loan
            </button>
            <p className="text-xs text-slate-400">
              Add up to all your loans (15+) to see totals, avalanche/snowball order, and extra payment impact.
            </p>
          </div>
        </div>
        <div className="card p-4 space-y-3">
          <h3 className="text-lg font-semibold">Payoff strategies</h3>
          <div>
            <p className="font-semibold">Avalanche (math-best)</p>
            <p className="text-sm text-slate-400">Target highest APR first; keeps interest lowest.</p>
            <ol className="space-y-1 list-decimal list-inside mt-2">
              {avalanche.ordered.map((d) => (
                <li key={d.id} className="text-slate-200">
                  {d.name} — APR {d.apr ?? 0}% — Balance ${d.balance.toFixed(0)}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="font-semibold">Snowball (motivation)</p>
            <p className="text-sm text-slate-400">Pay smallest balances first for quick wins.</p>
            <ol className="space-y-1 list-decimal list-inside mt-2">
              {snowball.ordered.map((d) => (
                <li key={d.id} className="text-slate-200">
                  {d.name} — Balance ${d.balance.toFixed(0)} — APR {d.apr ?? 0}%
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
            If you have 15+ loans: track total balance, monthly minimums/EMIs, highest APR, and payoff order. Test $10–
            $30 extra to see months shaved off; keep bumping extra until payoff date fits your target.
          </div>
        </div>
      </section>
    </div>
  );
}
