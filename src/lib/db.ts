import Dexie, { Table } from "dexie";
import { DebtAccount, Occurrence, Schedule } from "./types";

export class CalendarDB extends Dexie {
  debtAccounts!: Table<DebtAccount, number>;
  schedules!: Table<Schedule, number>;
  occurrences!: Table<Occurrence, number>;
  settings!: Table<{ id: string; key: string; value: string }, string>;
  backups!: Table<{ id?: number; createdAt: string; payload: string }, number>;

  constructor() {
    super("CalendarMBA");
    this.version(1).stores({
      debtAccounts: "++id, name, balance, apr, minPayment, dueDay, active",
      schedules: "++id, name, type, category, amount, startDate, frequency, interval, endDate, linkedDebtAccountId",
      occurrences: "++id, scheduleId, date, plannedAmount, status, paidAmount, paidDate",
      settings: "id, key",
      backups: "++id, createdAt"
    });
  }
}

export const db = new CalendarDB();
