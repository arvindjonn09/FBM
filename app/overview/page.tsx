"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "../../src/lib/db";
import type { DebtAccount, Occurrence, EntryType } from "../../src/lib/types";

type EnrichedOccurrence = Occurrence & { type: EntryType; amount: number };

const todayISO = new Date().toISOString().slice(0, 10);

const monthBounds = (d: Date) => {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  return { start, end };
};

export default function OverviewPage() {
  const [occurrences, setOccurrences] = useState<EnrichedOccurrence[]>([]);
  const [debts, setDebts] = useState<DebtAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const now = new Date();
      const { start, end } = monthBounds(now);
      const ahead = new Date();
      ahead.setDate(ahead.getDate() + 30);
      const aheadISO = ahead.toISOString().slice(0, 10);

      const occs = await db.occurrences.where("date").between(start, aheadISO, true, true).toArray();
      const schedIds = [...new Set(occs.map((o) => o.scheduleId))];
      const schedules = await db.schedules.bulkGet(schedIds);
      const map = new Map<number, { type: EntryType; amount: number }>();
      schedules.forEach((s, idx) => {
        if (s && schedIds[idx] !== undefined) map.set(schedIds[idx]!, { type: s.type, amount: s.amount });
      });
      setOccurrences(
        occs.map((o) => ({
          ...o,
          type: map.get(o.scheduleId)?.type ?? "debt",
          amount: map.get(o.scheduleId)?.amount ?? o.plannedAmount
        }))
      );
      setDebts(await db.debtAccounts.toArray());
      setLoading(false);
    };
    load();
  }, []);

  const metrics = useMemo(() => {
    const upcomingDebits = occurrences
      .filter((o) => o.type === "debt" && o.date >= todayISO)
      .reduce((s, o) => s + o.amount, 0);
    const upcomingCredits = occurrences
      .filter((o) => o.type === "credit" && o.date >= todayISO)
      .reduce((s, o) => s + o.amount, 0);
    const paidThisMonth = occurrences
      .filter((o) => o.status === "paid")
      .reduce(
        (acc, o) => {
          if (o.type === "debt") acc.debits += o.paidAmount ?? o.amount;
          else acc.credits += o.paidAmount ?? o.amount;
          return acc;
        },
        { debits: 0, credits: 0 }
      );
    const totalDebtBalance = debts.reduce((s, d) => s + d.balance, 0);
    const highestApr = debts.reduce((max, d) => Math.max(max, d.apr ?? 0), 0);
    return { upcomingDebits, upcomingCredits, paidThisMonth, totalDebtBalance, highestApr };
  }, [occurrences, debts]);

  const recommendations = useMemo(() => {
    const recs: string[] = [];
    if (metrics.highestApr > 0) recs.push(`Target highest APR first (${metrics.highestApr.toFixed(1)}%) with extra payments.`);
    if (metrics.upcomingDebits > metrics.upcomingCredits) {
      recs.push("Upcoming debits exceed credits in next 30 days — reduce discretionary or add income.");
    }
    if (metrics.totalDebtBalance > 0) recs.push("Snowball backup: pay smallest balance for quick win if motivation drops.");
    if (recs.length === 0) recs.push("Good shape: keep minimums + any surplus to highest APR debt.");
    return recs;
  }, [metrics]);

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm text-slate-400">Totals & recovery</p>
        <h1 className="text-2xl font-semibold">Debts vs credits overview</h1>
      </header>

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-sm text-slate-400">Upcoming 30d debits</p>
          <p className="text-2xl font-semibold text-rose-200">${metrics.upcomingDebits.toFixed(0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-400">Upcoming 30d credits</p>
          <p className="text-2xl font-semibold text-emerald-200">${metrics.upcomingCredits.toFixed(0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-400">Paid this month</p>
          <p className="text-lg font-semibold text-emerald-200">Credits ${metrics.paidThisMonth.credits.toFixed(0)}</p>
          <p className="text-lg font-semibold text-rose-200">Debits ${metrics.paidThisMonth.debits.toFixed(0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-400">Debt balance (tracked)</p>
          <p className="text-2xl font-semibold text-amber-200">${metrics.totalDebtBalance.toFixed(0)}</p>
          <p className="text-xs text-slate-400">Highest APR: {metrics.highestApr.toFixed(1)}%</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-2">Risk & recovery checklist</h2>
          <ul className="space-y-2 text-sm text-slate-200 list-disc list-inside">
            <li>Mark paid/partial promptly to keep forecasts accurate.</li>
            <li>Ensure every debt has balance, APR, and minimum — unlocks better payoff guidance.</li>
            <li>Create schedules for all recurring bills/income; recurrence engine handles future instances.</li>
            <li>Back up via Settings → Export regularly (local-only data).</li>
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-2">Recommendations</h2>
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-200 list-disc list-inside">
              {recommendations.map((r, idx) => (
                <li key={idx}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
