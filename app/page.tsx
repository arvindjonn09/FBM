"use client";

import { useEffect, useMemo, useState } from "react";
import { AddEntryModal } from "../components/AddEntryModal";
import { CalendarMonth } from "../components/CalendarMonth";
import { StatusChip } from "../components/StatusChip";
import { db } from "../src/lib/db";
import { generateOccurrences } from "../src/lib/recurrence";
import type { EntryType, Occurrence, Schedule } from "../src/lib/types";

type EnrichedOccurrence = Occurrence & { name: string; type: EntryType; amount: number };

const todayISO = new Date().toISOString().slice(0, 10);

const startOfMonthISO = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
const endOfMonthISO = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);

export default function Dashboard() {
  const [occurrences, setOccurrences] = useState<EnrichedOccurrence[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [month, setMonth] = useState<Date>(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [scheduleMap, setScheduleMap] = useState<Map<number, Schedule>>(new Map());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const start = startOfMonthISO(month);
      const end = endOfMonthISO(month);
      const windowStart = todayISO;
      const windowEnd = new Date();
      windowEnd.setDate(windowEnd.getDate() + 45);
      const windowEndISO = windowEnd.toISOString().slice(0, 10);

      const [monthOcc, windowOcc] = await Promise.all([
        db.occurrences.where("date").between(start, end, true, true).toArray(),
        db.occurrences.where("date").between(windowStart, windowEndISO, true, true).toArray()
      ]);
      const allOccMap = new Map<number, Occurrence>();
      [...monthOcc, ...windowOcc].forEach((o) => {
        if (o.id !== undefined) allOccMap.set(o.id, o);
      });
      const allOcc = Array.from(allOccMap.values());
      const scheduleIds = [...new Set(allOcc.map((o) => o.scheduleId))];
      const schedules = await db.schedules.bulkGet(scheduleIds);
      const map = new Map<number, Schedule>();
      schedules.forEach((s, idx) => {
        if (s && scheduleIds[idx] !== undefined) map.set(scheduleIds[idx]!, s);
      });
      setScheduleMap(map);

      const enriched = allOcc.map((o) => {
        const sched = map.get(o.scheduleId);
        return {
          ...o,
          name: sched?.name ?? "Entry",
          type: sched?.type ?? "debt",
          amount: sched?.amount ?? o.plannedAmount
        };
      });
      setOccurrences(enriched);
      setLoading(false);
    };

    load();
  }, [month, refreshToken]);

  const upcoming = useMemo(() => {
    const end = new Date();
    end.setDate(end.getDate() + 15);
    const endISO = end.toISOString().slice(0, 10);
    return occurrences
      .filter((o) => o.date >= todayISO && o.date <= endISO)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [occurrences]);

  const summary = useMemo(() => {
    const debits = upcoming.filter((i) => i.type === "debt").reduce((s, i) => s + i.amount, 0);
    const credits = upcoming.filter((i) => i.type === "credit").reduce((s, i) => s + i.amount, 0);
    return { debits, credits, net: credits - debits };
  }, [upcoming]);

  const selectedEntries = useMemo(
    () => occurrences.filter((o) => o.date === selectedDate).sort((a, b) => a.name.localeCompare(b.name)),
    [occurrences, selectedDate]
  );

  const calendarEntries = useMemo(
    () =>
      occurrences
        .filter((o) => o.date >= startOfMonthISO(month) && o.date <= endOfMonthISO(month))
        .map((o) => ({ date: o.date, type: o.type, status: o.status, name: o.name, amount: o.amount })),
    [occurrences, month]
  );

  return (
    <div className="grid gap-6">
      <section className="card px-5 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-400">Next 15 days</p>
            <h1 className="text-2xl font-semibold">Upcoming payments and income</h1>
          </div>
          <button
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 transition"
            onClick={() => setShowModal(true)}
          >
            + Add entry
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2 p-5">
          <header className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-slate-400">List</p>
              <h2 className="text-xl font-semibold">Upcoming 15 days</h2>
            </div>
            <div className="text-xs text-slate-400">Actions: Mark Paid · Snooze</div>
          </header>
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-slate-300">No items yet. Add one to get started.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {upcoming.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm text-slate-400">{item.date}</p>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{item.type === "debt" ? "Debt" : "Credit"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-lg font-semibold ${
                        item.type === "debt" ? "text-rose-300" : "text-emerald-300"
                      }`}
                    >
                      ${item.amount.toFixed(0)}
                    </span>
                    <StatusChip status={item.status} />
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/10"
                        onClick={async () => {
                          if (!item.id) return;
                          const today = new Date().toISOString().slice(0, 10);
                          await db.occurrences.update(item.id, { status: "paid", paidAmount: item.amount, paidDate: today });
                          setRefreshToken((n) => n + 1);
                        }}
                      >
                        Mark Paid
                      </button>
                      <button
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/5"
                        onClick={async () => {
                          if (!item.id) return;
                          const nextDate = new Date(item.date);
                          nextDate.setUTCDate(nextDate.getUTCDate() + 3);
                          await db.occurrences.update(item.id, { date: nextDate.toISOString().slice(0, 10), status: "scheduled" });
                          setRefreshToken((n) => n + 1);
                        }}
                      >
                        Snooze
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5 space-y-4">
          <header>
            <p className="text-sm text-slate-400">Snapshot</p>
            <h2 className="text-xl font-semibold">Cash & recommendations</h2>
          </header>
          <div className="rounded-xl border border-white/10 p-3 bg-white/5">
            <p className="text-xs uppercase tracking-wide text-slate-400">Next 15d totals</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-slate-200">Debits</span>
              <span className="text-rose-200 font-semibold">${summary.debits.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-200">Credits</span>
              <span className="text-emerald-200 font-semibold">${summary.credits.toFixed(0)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-400">Net</span>
              <span className={summary.net >= 0 ? "text-emerald-200" : "text-rose-200"}>
                ${summary.net.toFixed(0)}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 p-3 bg-emerald-500/5">
            <p className="text-xs uppercase tracking-wide text-emerald-300">Pay-first recommendation</p>
            <p className="mt-2 text-sm text-emerald-50">
              Avalanche: focus on highest APR debt while paying minimums on others. Toggle strategy in Debts tab.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 p-3 bg-white/5">
            <p className="text-xs uppercase tracking-wide text-slate-400">Calendar</p>
            <p className="mt-2 text-sm text-slate-200">Tap a date to add entry. Red = debt, green = credit.</p>
            <button
              className="mt-3 w-full rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
              onClick={() => setShowModal(true)}
            >
              Add for selected date
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CalendarMonth
            month={month}
            entries={calendarEntries}
            selectedDate={selectedDate}
            onSelectDate={(iso) => {
              setSelectedDate(iso);
              setShowModal(true);
            }}
          />
        </div>
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Selected date</p>
              <h2 className="text-xl font-semibold">{selectedDate}</h2>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-full border border-white/10 px-3 py-1 text-xs hover:bg-white/10"
                onClick={() => {
                  const next = new Date(month);
                  next.setUTCMonth(next.getUTCMonth() - 1);
                  setMonth(next);
                }}
              >
                ◀
              </button>
              <button
                className="rounded-full border border-white/10 px-3 py-1 text-xs hover:bg-white/10"
                onClick={() => {
                  const next = new Date(month);
                  next.setUTCMonth(next.getUTCMonth() + 1);
                  setMonth(next);
                }}
              >
                ▶
              </button>
            </div>
          </div>
          {selectedEntries.length === 0 ? (
            <p className="text-sm text-slate-300">No entries. Add one.</p>
          ) : (
            <div className="space-y-3">
              {selectedEntries.map((item) => (
                <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{item.name}</span>
                    <StatusChip status={item.status} />
                  </div>
                  <p className="text-sm text-slate-400 capitalize">{item.type}</p>
                  <p className="text-sm text-slate-200">${item.amount.toFixed(0)}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="rounded-full border border-rose-500/40 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/10"
                      onClick={async () => {
                        const schedId = item.scheduleId;
                        if (!schedId) return;
                        await db.transaction("rw", db.schedules, db.occurrences, async () => {
                          await db.occurrences.where("scheduleId").equals(schedId).delete();
                          await db.schedules.delete(schedId);
                        });
                        setRefreshToken((n) => n + 1);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 transition"
            onClick={() => setShowModal(true)}
          >
            + Add entry
          </button>
        </div>
      </section>

      <AddEntryModal
        open={showModal}
        defaultDate={selectedDate}
        onClose={() => setShowModal(false)}
        existingSchedule={editingSchedule}
        onSaved={() => {
          setEditingSchedule(null);
          setRefreshToken((n) => n + 1);
        }}
      />
    </div>
  );
}
