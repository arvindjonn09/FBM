"use client";

import { useMemo } from "react";

const sampleOcc = [
  { date: "2024-01-01", type: "credit", amount: 2400 },
  { date: "2024-01-03", type: "debt", amount: 320 },
  { date: "2024-01-05", type: "debt", amount: 180 },
  { date: "2024-01-08", type: "debt", amount: 950 },
  { date: "2024-01-15", type: "credit", amount: 600 }
];

export default function AnalyticsPage() {
  const totals = useMemo(() => {
    const credits = sampleOcc.filter((o) => o.type === "credit").reduce((s, o) => s + o.amount, 0);
    const debits = sampleOcc.filter((o) => o.type === "debt").reduce((s, o) => s + o.amount, 0);
    return { credits, debits, net: credits - debits };
  }, []);

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm text-slate-400">Analytics</p>
        <h1 className="text-2xl font-semibold">Cashflow and payoff insight</h1>
      </header>
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <p className="text-sm text-slate-400">Monthly credits</p>
          <p className="text-2xl font-semibold text-emerald-200">${totals.credits.toFixed(0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-400">Monthly debits</p>
          <p className="text-2xl font-semibold text-rose-200">${totals.debits.toFixed(0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-400">Net</p>
          <p className={`text-2xl font-semibold ${totals.net >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
            ${totals.net.toFixed(0)}
          </p>
        </div>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="text-lg font-semibold">Pay-first recommendation</h2>
        <p className="text-sm text-slate-300">
          Avalanche: apply extra $50/week to highest APR debt. Snowball: apply to smallest balance. Update balances to
          see payoff dates.
        </p>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
          Rolling 30d cashflow forecast will appear here once data is loaded from IndexedDB.
        </div>
      </section>
    </div>
  );
}
