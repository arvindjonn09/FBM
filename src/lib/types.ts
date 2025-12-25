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

export interface ImportBatch {
  id?: number;
  importBatchId: string;
  sourceKey: string;
  fileName?: string;
  importedAt: string;
  rowCount: number;
}

export interface BankTransaction {
  id?: number;
  importBatchId: string;
  sourceKey: string;
  dateISO: string;
  description: string;
  signedAmount: number;
  direction: "debit" | "credit";
  categoryKey: string;
  profileKey: "it" | "uber" | "personal";
  gstAmount?: number;
  gstTreatment?: "taxable" | "gst_free" | "input_taxed";
  amountType?: "inc" | "ex";
  confidence?: number;
  matchedRule?: string;
  dedupeKey?: string;
}

export interface CsvMapping {
  sourceKey: string;
  headersSignature: string;
  mappingJson: string;
}

export interface CategoryRule {
  id?: number;
  pattern: string;
  matchType: "contains" | "startsWith" | "equals";
  categoryKey: string;
  profileKey?: "it" | "uber" | "personal";
  priority: number;
  enabled: boolean;
}
