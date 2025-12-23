import { Occurrence, Schedule } from "./types";

const ISO_FORMAT_OPTIONS = { timeZone: "UTC" } as const;

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
};

const frequencyToDays = (frequency: Schedule["frequency"], interval = 1) => {
  switch (frequency) {
    case "weekly":
      return 7 * interval;
    case "fortnightly":
      return 14 * interval;
    case "monthly":
      return 30 * interval;
    case "yearly":
      return 365 * interval;
    default:
      return 0;
  }
};

export function generateOccurrences(schedule: Schedule, monthsAhead = 12, fromDate?: string): Occurrence[] {
  const occurrences: Occurrence[] = [];
  const start = new Date(fromDate ?? schedule.startDate);
  const endBoundary = addMonths(start, monthsAhead);
  const interval = schedule.interval ?? 1;
  let cursor = new Date(schedule.startDate);

  const inRange = (d: Date) => d <= endBoundary && (!schedule.endDate || d <= new Date(schedule.endDate));

  if (schedule.frequency === "none") {
    if (inRange(cursor)) {
      occurrences.push({
        scheduleId: schedule.id ?? -1,
        date: toISODate(cursor),
        plannedAmount: schedule.amount,
        status: "scheduled"
      });
    }
    return occurrences;
  }

  while (inRange(cursor)) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!fromDate || new Date(iso) >= start) {
      occurrences.push({
        scheduleId: schedule.id ?? -1,
        date: iso,
        plannedAmount: schedule.amount,
        status: "scheduled"
      });
    }
    if (schedule.frequency === "monthly" || schedule.frequency === "yearly") {
      cursor = addMonths(cursor, schedule.frequency === "monthly" ? interval : 12 * interval);
    } else {
      cursor = addDays(cursor, frequencyToDays(schedule.frequency, interval));
    }
  }

  return occurrences;
}

export const isMissed = (occ: Occurrence, todayISO: string) => {
  return occ.status === "scheduled" && occ.date < todayISO;
};
