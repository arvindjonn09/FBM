export type Status = "scheduled" | "paid" | "partial" | "skipped" | "missed";

export type Frequency = "none" | "weekly" | "fortnightly" | "monthly" | "yearly";

export type EntryType = "debt" | "credit";

export interface DebtAccount {
  id?: number;
  name: string;
  balance: number;
  apr?: number;
  minPayment?: number;
  dueDay?: number;
  active: boolean;
}

export interface Schedule {
  id?: number;
  name: string;
  type: EntryType;
  category: string;
  amount: number;
  startDate: string; // ISO date (yyyy-mm-dd)
  frequency: Frequency;
  interval?: number;
  endDate?: string | null;
  linkedDebtAccountId?: number | null;
  notes?: string;
}

export interface Occurrence {
  id?: number;
  scheduleId: number;
  date: string; // ISO date
  plannedAmount: number;
  status: Status;
  paidAmount?: number | null;
  paidDate?: string | null;
}

export interface BackupPayload {
  debtAccounts: DebtAccount[];
  schedules: Schedule[];
  occurrences: Occurrence[];
}

export interface DeductionEntry {
  id?: number;
  profileKey: "it" | "uber";
  date: string; // YYYY-MM-DD
  categoryKey: string;
  description?: string;
  amount: number;
  workUsePercent: number;
  receipt: boolean;
  method?: string;
  km?: number;
  notes?: string;
}
