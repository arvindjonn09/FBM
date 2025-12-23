"use client";

import { useMemo, useState } from "react";
import { db } from "../src/lib/db";
import { generateOccurrences } from "../src/lib/recurrence";
import type { Frequency, Schedule } from "../src/lib/types";
import { useResettingForm } from "./hooks/useResettingForm";

type Props = {
  open: boolean;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
  existingSchedule?: Schedule | null;
};

const frequencies: Frequency[] = ["none", "weekly", "fortnightly", "monthly", "yearly"];

export function AddEntryModal({ open, onClose, onSaved, defaultDate, existingSchedule }: Props) {
  const initialForm = useMemo(
    () => ({
      name: existingSchedule?.name ?? "",
      type: existingSchedule?.type ?? "debt",
      category: existingSchedule?.category ?? "Other",
      amount: existingSchedule?.amount ?? 0,
      startDate: existingSchedule?.startDate ?? defaultDate,
      frequency: (existingSchedule?.frequency ?? "none") as Frequency,
      interval: existingSchedule?.interval ?? 1,
      endDate: existingSchedule?.endDate ?? undefined,
      notes: existingSchedule?.notes ?? "",
      linkedDebtAccountId: existingSchedule?.linkedDebtAccountId ?? null
    }),
    [defaultDate, existingSchedule]
  );
  const [form, setForm] = useState<Partial<Schedule>>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useResettingForm(() => {
    setForm(initialForm);
    setError(null);
  }, [open, defaultDate]);

  if (!open) return null;

  const update = (key: keyof Schedule, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.name || !form.type || !form.amount || !form.startDate || !form.frequency) {
      setError("Fill in name, type, amount, start date, and frequency.");
      return;
    }
    const schedule: Schedule = {
      name: form.name,
      type: form.type,
      category: form.category || "Other",
      amount: Number(form.amount),
      startDate: form.startDate,
      frequency: form.frequency,
      interval: form.interval ?? 1,
      endDate: form.endDate || null,
      notes: form.notes || "",
      linkedDebtAccountId: form.linkedDebtAccountId ?? null
    };
    setSaving(true);
    try {
      if (existingSchedule?.id) {
        await db.transaction("rw", db.schedules, db.occurrences, async () => {
          await db.schedules.update(existingSchedule.id!, schedule);
          await db.occurrences.where("scheduleId").equals(existingSchedule.id!).delete();
          const occurrences = generateOccurrences({ ...schedule, id: existingSchedule.id }, 12);
          const withSchedule = occurrences.map((o) => ({ ...o, scheduleId: existingSchedule.id! }));
          await db.occurrences.bulkAdd(withSchedule);
        });
      } else {
        const scheduleId = await db.schedules.add(schedule);
        const occurrences = generateOccurrences({ ...schedule, id: scheduleId }, 12);
        const withSchedule = occurrences.map((o) => ({ ...o, scheduleId }));
        await db.occurrences.bulkAdd(withSchedule);
      }
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      setError("Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900/90 p-6 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Add entry</p>
            <h2 className="text-xl font-semibold">Debt or credit</h2>
          </div>
          <button className="text-sm text-slate-300 hover:text-white" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="col-span-2 text-sm text-slate-300">
            Name
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
              value={form.name ?? ""}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g., VISA, Salary, Car loan"
            />
          </label>
          <label className="text-sm text-slate-300">
            Type
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
              value={form.type ?? "debt"}
              onChange={(e) => update("type", e.target.value as Schedule["type"])}
            >
              <option value="debt">Debt</option>
              <option value="credit">Credit</option>
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Category
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
              value={form.category ?? "Other"}
              onChange={(e) => update("category", e.target.value)}
            >
              <option>Loan</option>
              <option>Credit card</option>
              <option>Bill</option>
              <option>Personal</option>
              <option>Income</option>
              <option>Other</option>
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Amount
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
              value={form.amount ?? 0}
              onChange={(e) => update("amount", Number(e.target.value))}
            />
          </label>
          <label className="text-sm text-slate-300">
            Start date
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
              value={form.startDate ?? ""}
              onChange={(e) => update("startDate", e.target.value)}
            />
          </label>
          <label className="text-sm text-slate-300">
            Frequency
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
              value={form.frequency ?? "none"}
              onChange={(e) => update("frequency", e.target.value as Frequency)}
            >
              {frequencies.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Interval
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
              value={form.interval ?? 1}
              onChange={(e) => update("interval", Number(e.target.value))}
            />
          </label>
          <label className="text-sm text-slate-300">
            End date (optional)
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
              value={form.endDate ?? ""}
              onChange={(e) => update("endDate", e.target.value || null)}
            />
          </label>
          <label className="col-span-2 text-sm text-slate-300">
            Notes (optional)
            <textarea
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => update("notes", e.target.value)}
            />
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

        <div className="mt-5 flex items-center gap-3">
          <button
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-60"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save entry"}
          </button>
          <button className="text-sm text-slate-300 hover:text-white" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
