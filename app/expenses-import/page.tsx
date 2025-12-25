"use client";

import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { db } from "../../src/lib/db";
import { applyRules, detectMapping, headersSignature, normalizeRows, parseCsv } from "../../src/lib/expenses/parser";
import type { BankTransaction, CategoryRule, CsvMapping } from "../../src/lib/types";

const sources = [
  { key: "commbank", label: "CommBank" },
  { key: "anz", label: "ANZ" },
  { key: "stgeorge", label: "St.George" },
  { key: "zip", label: "Zip Pay" },
  { key: "generic", label: "Generic CSV" }
];

type Mapping = { date: string; description: string; amount: string; debit: string; credit: string };

export default function ExpensesImportPage() {
  const [sourceKey, setSourceKey] = useState("commbank");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({ date: "", description: "", amount: "", debit: "", credit: "" });
  const [parsedRows, setParsedRows] = useState<BankTransaction[]>([]);
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);
  const [csvMappings, setCsvMappings] = useState<CsvMapping[]>([]);
  const [needsMappingWizard, setNeedsMappingWizard] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [rules, mappings] = await Promise.all([db.categoryRules.toArray(), db.csvMappings.toArray()]);
      setCategoryRules(rules);
      setCsvMappings(mappings);
    };
    load();
  }, []);

  const inferredMapping = useMemo(() => {
    const saved = csvMappings.find(
      (m) => m.sourceKey === sourceKey && m.headersSignature === headersSignature(headers)
    );
    return detectMapping(headers, saved);
  }, [headers, csvMappings, sourceKey]);

  const onFile = async (file: File) => {
    setStatus(null);
    const text = await file.text();
    setFileName(file.name);
    const { headers: hdrs, rows } = parseCsv(text);
    setHeaders(hdrs);
    const map = detectMapping(hdrs, undefined);
    setMapping(map as Mapping);
    const missingRequired = !map.date || !map.description || (!map.amount && !(map.debit && map.credit));
    setNeedsMappingWizard(missingRequired);
    if (!missingRequired) {
      const normalized = normalizeRows(rows, map as Mapping, sourceKey);
      const categorised = applyRules(normalized, categoryRules);
      setParsedRows(categorised.slice(0, 50));
    } else {
      setParsedRows([]);
    }
  };

  const saveMapping = async () => {
    const sig = headersSignature(headers);
    const mappingJson = JSON.stringify(mapping);
    await db.csvMappings.put({ sourceKey, headersSignature: sig, mappingJson });
    const updated = await db.csvMappings.toArray();
    setCsvMappings(updated);
    setNeedsMappingWizard(false);
    setStatus("Mapping saved for this header set.");
  };

  const reparse = () => {
    setStatus(null);
    const dummyRows = parsedRows.length > 0 ? parsedRows : [];
    if (headers.length === 0) return;
    const map = mapping;
    const { rows } = parseCsv((window as any)._lastCsvText || "");
    const normalized = normalizeRows(rows, map as Mapping, sourceKey);
    const categorised = applyRules(normalized, categoryRules);
    setParsedRows(categorised.slice(0, 50));
  };

  const saveBatch = async () => {
    if (parsedRows.length === 0) {
      setStatus("No rows to save.");
      return;
    }
    const batchId = uuidv4();
    const now = new Date().toISOString();
    const unique = new Map<string, BankTransaction>();
    parsedRows.forEach((t) => {
      unique.set(t.dedupeKey ?? `${t.dateISO}|${t.signedAmount}|${t.description}|${sourceKey}`, t);
    });
    const finalRows = Array.from(unique.values()).map((t) => ({
      ...t,
      importBatchId: batchId,
      sourceKey,
      profileKey: (t.profileKey as any) ?? "personal",
      categoryKey: t.categoryKey || "uncategorised"
    }));
    await db.transaction("rw", db.importBatches, db.bankTransactions, async () => {
      await db.importBatches.add({
        importBatchId: batchId,
        sourceKey,
        fileName,
        importedAt: now,
        rowCount: finalRows.length
      });
      await db.bankTransactions.bulkAdd(finalRows);
    });
    const totalDebits = finalRows.filter((t) => t.signedAmount < 0).reduce((s, t) => s + t.signedAmount, 0);
    const totalCredits = finalRows.filter((t) => t.signedAmount > 0).reduce((s, t) => s + t.signedAmount, 0);
    setStatus(`Saved ${finalRows.length} rows. Debits ${totalDebits.toFixed(2)}, Credits ${totalCredits.toFixed(2)}.`);
  };

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm text-slate-400">Expenses Import</p>
        <h1 className="text-2xl font-semibold">Bank statement importer (local-only)</h1>
      </header>

      <section className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-300">
            Source
            <select
              className="mt-1 rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
              value={sourceKey}
              onChange={(e) => setSourceKey(e.target.value)}
            >
              {sources.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="mt-1 text-sm"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                (window as any)._lastCsvText = await file.text();
                await onFile(file);
              }}
            />
          </label>
          {status && <span className="text-sm text-emerald-200">{status}</span>}
        </div>
        {needsMappingWizard && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
            <p className="text-sm font-semibold text-amber-200">Mapping Wizard</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {["date", "description", "amount", "debit", "credit"].map((field) => (
                <label key={field} className="text-slate-200">
                  {field}
                  <select
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                    value={(mapping as any)[field] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                  >
                    <option value="">--</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button
              className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
              onClick={() => {
                saveMapping();
                reparse();
              }}
            >
              Save mapping & reparse
            </button>
          </div>
        )}
      </section>

      {parsedRows.length > 0 && (
        <section className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Preview</p>
              <h2 className="text-lg font-semibold">First {parsedRows.length} rows</h2>
            </div>
            <button
              className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
              onClick={saveBatch}
            >
              Save to device
            </button>
          </div>
          <div className="overflow-auto max-h-[400px]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Profile</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, idx) => (
                  <tr key={idx} className="border-t border-white/5">
                    <td className="py-2 pr-4">{row.dateISO}</td>
                    <td className="py-2 pr-4">{row.description}</td>
                    <td className="py-2 pr-4">{row.signedAmount.toFixed(2)}</td>
                    <td className="py-2 pr-4">
                      <select
                        className="rounded-lg border border-white/10 bg-slate-800/60 px-2 py-1"
                        value={row.profileKey}
                        onChange={(e) => {
                          const val = e.target.value as BankTransaction["profileKey"];
                          setParsedRows((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, profileKey: val } : r))
                          );
                        }}
                      >
                        <option value="personal">Personal</option>
                        <option value="it">IT</option>
                        <option value="uber">Uber</option>
                      </select>
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        className="rounded-lg border border-white/10 bg-slate-800/60 px-2 py-1 w-36"
                        value={row.categoryKey || ""}
                        onChange={(e) =>
                          setParsedRows((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, categoryKey: e.target.value } : r))
                          )
                        }
                      />
                      <label className="ml-2 text-xs text-slate-400 inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          onChange={async (e) => {
                            if (!e.target.checked) return;
                            const pattern = row.description.slice(0, 30);
                            const newRule: CategoryRule = {
                              pattern,
                              matchType: "contains",
                              categoryKey: row.categoryKey || "uncategorised",
                              profileKey: row.profileKey,
                              priority: 100,
                              enabled: true
                            };
                            await db.categoryRules.add(newRule);
                            const rules = await db.categoryRules.toArray();
                            setCategoryRules(rules);
                            setStatus("Learned rule for future imports.");
                          }}
                        />
                        Remember
                      </label>
                    </td>
                    <td className="py-2 pr-4">{(row.confidence ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
