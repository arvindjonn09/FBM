"use client";

import { useMemo } from "react";
import type { EntryType, Status } from "../src/lib/types";

type CalendarEntry = {
  date: string;
  type: EntryType;
  status: Status;
  name: string;
  amount: number;
};

type Props = {
  month: Date;
  entries: CalendarEntry[];
  selectedDate: string;
  onSelectDate: (iso: string) => void;
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarMonth({ month, entries, selectedDate, onSelectDate }: Props) {
  const { days } = useMemo(() => {
    const start = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
    const end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
    const startDay = start.getUTCDay();
    const totalDays = end.getUTCDate();
    const cells: { date: string | null; entries: CalendarEntry[] }[] = [];
    for (let i = 0; i < startDay; i++) cells.push({ date: null, entries: [] });
    for (let day = 1; day <= totalDays; day++) {
      const iso = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day)).toISOString().slice(0, 10);
      const items = entries.filter((e) => e.date === iso);
      cells.push({ date: iso, entries: items });
    }
    return { days: cells };
  }, [month, entries]);

  return (
    <div className="card p-5">
      <header className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm text-slate-400">Calendar</p>
          <h2 className="text-xl font-semibold">
            {month.toLocaleString("default", { month: "long" })} {month.getUTCFullYear()}
          </h2>
        </div>
      </header>
      <div className="grid grid-cols-7 gap-2 text-xs text-slate-400 mb-2">
        {dayNames.map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((cell, idx) =>
          cell.date ? (
            <button
              key={cell.date}
              onClick={() => onSelectDate(cell.date!)}
              className={`aspect-square rounded-xl border border-white/5 bg-white/5 p-2 text-left hover:border-emerald-400/60 ${
                selectedDate === cell.date ? "border-emerald-400/70 bg-emerald-500/5" : ""
              }`}
            >
              <div className="text-sm font-semibold text-slate-100">{Number(cell.date.slice(-2))}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {cell.entries.slice(0, 3).map((e, i) => (
                  <span
                    key={`${cell.date}-${i}`}
                    className={`h-2 w-2 rounded-full ${
                      e.type === "debt" ? "bg-rose-400" : "bg-emerald-400"
                    }`}
                    title={`${e.name} ${e.type} $${e.amount}`}
                  />
                ))}
                {cell.entries.length > 3 && (
                  <span className="text-[10px] text-slate-300">+{cell.entries.length - 3}</span>
                )}
              </div>
            </button>
          ) : (
            <div key={`empty-${idx}`} />
          )
        )}
      </div>
    </div>
  );
}
