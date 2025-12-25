import type { BankTransaction, CategoryRule, CsvMapping } from "../types";
import crypto from "crypto";

export type ParsedRow = {
  date?: string;
  description?: string;
  amount?: number;
  debit?: number;
  credit?: number;
  raw?: Record<string, string>;
};

const dateHeaders = ["date", "transaction date", "posting date", "value date"];
const descHeaders = ["description", "details", "narrative", "merchant", "reference"];
const amountHeaders = ["amount", "amt", "value"];
const debitHeaders = ["debit", "withdrawal", "debits"];
const creditHeaders = ["credit", "deposit", "credits"];

const cleanHeader = (h: string) => h.trim().toLowerCase();

export const headersSignature = (headers: string[]) =>
  crypto.createHash("md5").update(headers.map(cleanHeader).join("|")).digest("hex");

export function detectMapping(headers: string[], saved?: CsvMapping) {
  const cleaned = headers.map(cleanHeader);
  const find = (candidates: string[]) =>
    cleaned.find((h) => candidates.some((c) => h.includes(c))) ?? "";
  const mapping = {
    date: find(dateHeaders),
    description: find(descHeaders),
    amount: find(amountHeaders),
    debit: find(debitHeaders),
    credit: find(creditHeaders)
  };
  if (saved) {
    try {
      const parsed = JSON.parse(saved.mappingJson);
      return { ...mapping, ...parsed };
    } catch {
      return mapping;
    }
  }
  return mapping;
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",");
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = cols[idx]?.trim() ?? "";
    });
    return record;
  });
  return { headers, rows };
}

const cleanAmount = (val?: string) => {
  if (!val) return 0;
  const stripped = val.replace(/[$,]/g, "").trim();
  if (/^\(.*\)$/.test(stripped)) {
    return -Number(stripped.slice(1, -1));
  }
  const num = Number(stripped);
  return isNaN(num) ? 0 : num;
};

const normalizeDate = (val?: string) => {
  if (!val) return "";
  const parts = val.includes("/") ? val.split("/") : val.split("-");
  if (parts[0].length === 4) return val.slice(0, 10);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return val;
};

export function normalizeRows(rows: Record<string, string>[], mapping: Record<string, string>, sourceKey: string) {
  const cleaned = rows.map((r) => {
    const date = normalizeDate(r[mapping.date]);
    const description = r[mapping.description] || "";
    const amountVal = mapping.amount ? cleanAmount(r[mapping.amount]) : 0;
    const debitVal = mapping.debit ? cleanAmount(r[mapping.debit]) : 0;
    const creditVal = mapping.credit ? cleanAmount(r[mapping.credit]) : 0;
    const signedAmount = mapping.amount ? amountVal : creditVal - debitVal;
    const direction = signedAmount >= 0 ? "credit" : "debit";
    return {
      dateISO: date,
      description,
      signedAmount,
      direction,
      sourceKey,
      dedupeKey: `${date}|${signedAmount}|${description}|${sourceKey}`
    } as BankTransaction;
  });
  return cleaned;
}

export function applyRules(txns: BankTransaction[], rules: CategoryRule[]) {
  const sorted = [...rules].filter((r) => r.enabled !== false).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return txns.map((t) => {
    let categoryKey = t.categoryKey || "uncategorised";
    let profileKey = t.profileKey || "personal";
    let confidence = 0.2;
    let matchedRule = "";
    const desc = t.description.toLowerCase();
    for (const rule of sorted) {
      const token = rule.pattern.toLowerCase();
      const hit =
        rule.matchType === "contains"
          ? desc.includes(token)
          : rule.matchType === "startsWith"
          ? desc.startsWith(token)
          : desc === token;
      if (hit) {
        categoryKey = rule.categoryKey;
        profileKey = (rule.profileKey as any) || profileKey;
        confidence = rule.priority >= 90 ? 0.9 : 0.75;
        matchedRule = rule.pattern;
        break;
      }
    }
    if (desc.includes("uber")) {
      profileKey = "uber";
      confidence = Math.max(confidence, 0.75);
    }
    if (desc.includes("zip")) {
      categoryKey = "zip_payments_or_purchases";
      confidence = Math.max(confidence, 0.75);
    }
    return { ...t, categoryKey, profileKey, confidence, matchedRule, dateISO: t.dateISO, description: t.description };
  });
}
import { toDisplay } from "../date";
