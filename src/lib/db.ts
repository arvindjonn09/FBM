import Dexie, { Table } from "dexie";
import { DebtAccount, DeductionEntry, Occurrence, Schedule } from "./types";

export class CalendarDB extends Dexie {
  debtAccounts!: Table<DebtAccount, number>;
  schedules!: Table<Schedule, number>;
  occurrences!: Table<Occurrence, number>;
  settings!: Table<{ id: string; key: string; value: string }, string>;
  backups!: Table<{ id?: number; createdAt: string; payload: string }, number>;
  profiles!: Table<{ id?: number; key: "it" | "uber"; name: string }, number>;
  deductionEntries!: Table<DeductionEntry & { attachmentData?: string; amountType?: "inc" | "ex"; gstTreatment?: "taxable" | "gst_free" | "input_taxed" }, number>;
  gstEntries!: Table<{
    id?: number;
    profileKey: "uber";
    date: string;
    type: "sale" | "purchase";
    description: string;
    amount: number;
    amountType: "inc" | "ex";
    gstTreatment: "taxable" | "gst_free" | "input_taxed";
    gstAmount: number;
    receipt: boolean;
  }, number>;

  constructor() {
    super("CalendarMBA");
    this.version(1).stores({
      debtAccounts: "++id, name, balance, apr, minPayment, dueDay, active",
      schedules: "++id, name, type, category, amount, startDate, frequency, interval, endDate, linkedDebtAccountId",
      occurrences: "++id, scheduleId, date, plannedAmount, status, paidAmount, paidDate",
      settings: "id, key",
      backups: "++id, createdAt"
    });
    this.version(2).stores({
      profiles: "++id, key, name",
      deductionEntries:
        "++id, profileKey, date, categoryKey, amount, workUsePercent, method, km, receipt, notes",
      gstEntries:
        "++id, profileKey, date, type, amount, amountType, gstTreatment, gstAmount, receipt"
    });
    this.version(3).stores({
      profiles: "++id, key, name",
      deductionEntries:
        "++id, profileKey, date, categoryKey, amount, workUsePercent, method, km, receipt, notes, attachmentData",
      gstEntries:
        "++id, profileKey, date, type, amount, amountType, gstTreatment, gstAmount, receipt"
    });
  }
}

export const db = new CalendarDB();
