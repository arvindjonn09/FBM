import clsx from "clsx";
import type { Status } from "../src/lib/types";

const colors: Record<Status, string> = {
  scheduled: "bg-slate-800 text-slate-200 border-slate-700",
  paid: "bg-emerald-900/60 text-emerald-300 border-emerald-700/60",
  partial: "bg-amber-900/60 text-amber-200 border-amber-700/60",
  skipped: "bg-slate-800 text-slate-400 border-slate-700",
  missed: "bg-rose-900/60 text-rose-200 border-rose-700/60"
};

export function StatusChip({ status }: { status: Status }) {
  return <span className={clsx("chip capitalize", colors[status])}>{status}</span>;
}
