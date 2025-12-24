"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "../../src/lib/db";
import { rules, type ProfileKey } from "../../src/lib/ato/rules";
import { computeGst } from "../../src/lib/ato/gst";
import { validateDeduction, type DeductionEntryInput } from "../../src/lib/ato/validation";
import { getTaxYear } from "../../src/lib/ato/helpers";
import { incomeTaxResident, medicareLevy } from "../../src/lib/ato/tax";
import type { DeductionEntry as DeductionEntryBase } from "../../src/lib/types";

type DeductionEntry = DeductionEntryBase & {
  id?: number;
  attachmentData?: string;
  amountType?: "inc" | "ex";
  gstTreatment?: "taxable" | "gst_free" | "input_taxed";
};

type GstEntry = {
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
};

const todayISO = new Date().toISOString().slice(0, 10);
const currentTaxYear = getTaxYear(todayISO);
const CENTS_PER_KM_RATE = 0.78; // ATO cents per km rate (keep updated)

export default function AtoPage() {
  const [profile, setProfile] = useState<ProfileKey>("it");
  const [deductions, setDeductions] = useState<DeductionEntry[]>([]);
  const [gstEntries, setGstEntries] = useState<GstEntry[]>([]);
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [showGstModal, setShowGstModal] = useState(false);
  const [deductionForm, setDeductionForm] = useState<DeductionEntry>({
    profileKey: "it",
    date: todayISO,
    categoryKey: rules.it.categories[0].key,
    description: "",
    amount: 0,
    workUsePercent: 100,
    receipt: true,
    amountType: "inc",
    gstTreatment: "taxable"
  });
  const [gstForm, setGstForm] = useState<GstEntry>({
    profileKey: "uber",
    date: todayISO,
    type: "sale",
    description: "",
    amount: 0,
    amountType: "inc",
    gstTreatment: "taxable",
    gstAmount: 0,
    receipt: true
  });
  const [tab, setTab] = useState<"deductions" | "gst" | "tax">("deductions");
  const [taxInputs, setTaxInputs] = useState({ year: currentTaxYear, itIncome: 0, uberIncome: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bootstrapProfiles = async () => {
      const count = await db.profiles.count();
      if (count === 0) {
        await db.profiles.bulkAdd([
          { key: "it", name: "IT" },
          { key: "uber", name: "Uber" }
        ]);
      }
    };
    bootstrapProfiles();
  }, []);

  useEffect(() => {
    const load = async () => {
      const [ded, gst] = await Promise.all([db.deductionEntries.toArray(), db.gstEntries.toArray()]);
      setDeductions(ded as DeductionEntry[]);
      setGstEntries(gst as GstEntry[]);
    };
    load();
  }, []);

  const filteredDeductions = useMemo(
    () => deductions.filter((d) => d.profileKey === profile && getTaxYear(d.date) === taxInputs.year),
    [deductions, profile, taxInputs.year]
  );

  const totals = useMemo(() => {
    const dedTotal = filteredDeductions.reduce((s, d) => s + d.amount * (d.workUsePercent / 100), 0);
    const uberDeductions = deductions
      .filter((d) => d.profileKey === "uber" && getTaxYear(d.date) === taxInputs.year)
      .reduce((s, d) => s + d.amount * (d.workUsePercent / 100), 0);
    const gstSales = gstEntries
      .filter((g) => g.type === "sale")
      .reduce((s, g) => s + g.gstAmount * (g.gstTreatment === "taxable" ? 1 : 0), 0);
    const gstPurchases = gstEntries
      .filter((g) => g.type === "purchase")
      .reduce((s, g) => s + g.gstAmount * (g.gstTreatment === "taxable" ? 1 : 0), 0);
    const uberProfit = taxInputs.uberIncome - uberDeductions;
    const taxable = taxInputs.itIncome + uberProfit - dedTotal;
    const baseTax = incomeTaxResident(Math.max(0, taxable));
    const levy = medicareLevy(Math.max(0, taxable));
    return { dedTotal, uberDeductions, gstSales, gstPurchases, uberProfit, taxable, baseTax, levy };
  }, [filteredDeductions, deductions, gstEntries, taxInputs]);

  const saveDeduction = async () => {
    setError(null);
    const input: DeductionEntryInput = {
      profileKey: profile,
      date: deductionForm.date,
      categoryKey: deductionForm.categoryKey,
      description: deductionForm.description || "",
      amount: deductionForm.amount,
      workUsePercent: deductionForm.workUsePercent,
      method: deductionForm.method,
      km: deductionForm.km
    };
    const msg = validateDeduction(input, { existingDeductions: deductions });
    if (msg) {
      setError(msg);
      return;
    }
    const amount =
      profile === "uber" && deductionForm.categoryKey === "car_expenses" && deductionForm.method === "cents_per_km"
        ? (deductionForm.km ?? 0) * CENTS_PER_KM_RATE
        : deductionForm.amount;
    await db.transaction("rw", db.deductionEntries, db.gstEntries, async () => {
      const id = await db.deductionEntries.add({ ...deductionForm, profileKey: profile, amount });
      setDeductions((prev) => [...prev, { ...deductionForm, profileKey: profile, id, amount }]);
      if (profile === "uber") {
        const gstAmount = computeGst({
          amount,
          amountType: deductionForm.amountType ?? "inc",
          gstTreatment: deductionForm.gstTreatment ?? "taxable"
        });
        if (gstAmount > 0) {
          await db.gstEntries.add({
            profileKey: "uber",
            date: deductionForm.date,
            type: "purchase",
            description: deductionForm.description || deductionForm.categoryKey,
            amount,
            amountType: deductionForm.amountType ?? "inc",
            gstTreatment: deductionForm.gstTreatment ?? "taxable",
            gstAmount,
            receipt: deductionForm.receipt
          });
        }
      }
    });
    setShowDeductionModal(false);
    setDeductionForm({
      profileKey: profile,
      date: todayISO,
      categoryKey: rules[profile].categories[0].key,
      description: "",
      amount: 0,
      workUsePercent: 100,
      receipt: true,
      amountType: "inc",
      gstTreatment: "taxable"
    });
  };

  const saveGst = async () => {
    const gstAmount = computeGst(gstForm);
    const payload = { ...gstForm, gstAmount };
    await db.transaction("rw", db.gstEntries, async () => {
      const id = await db.gstEntries.add(payload);
      setGstEntries((prev) => [...prev, { ...payload, id }]);
    });
    setShowGstModal(false);
    setGstForm({
      profileKey: "uber",
      date: todayISO,
      type: "sale",
      description: "",
      amount: 0,
      amountType: "inc",
      gstTreatment: "taxable",
      gstAmount: 0,
      receipt: true
    });
  };

  const categories = rules[profile].categories;

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm text-slate-400">ATO</p>
        <h1 className="text-2xl font-semibold">Local-only tax, GST, and deductions tracker</h1>
      </header>

      <div className="flex items-center gap-3">
        <div className="rounded-full bg-white/5 border border-white/10 p-1 flex">
          {(["it", "uber"] as ProfileKey[]).map((key) => (
            <button
              key={key}
              className={`px-4 py-2 rounded-full text-sm ${
                profile === key ? "bg-emerald-500 text-slate-900 font-semibold" : "text-slate-200"
              }`}
              onClick={() => {
                setProfile(key);
                if (key === "uber") setTab(tab === "gst" ? "gst" : "deductions");
                if (key === "it" && tab === "gst") setTab("deductions");
              }}
            >
              {rules[key].name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        {["deductions", "gst", "tax"].map((t) => {
          if (t === "gst" && profile !== "uber") return null;
          return (
            <button
              key={t}
              className={`rounded-full border px-4 py-2 ${
                tab === t ? "border-emerald-400 text-emerald-200" : "border-white/10 text-slate-200"
              }`}
              onClick={() => setTab(t as typeof tab)}
            >
              {t === "deductions" ? "Deductions" : t === "gst" ? "GST" : "Tax Estimate"}
            </button>
          );
        })}
      </div>

      {tab === "deductions" && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Claimable categories</p>
                <h2 className="text-lg font-semibold">{rules[profile].name}</h2>
              </div>
              <button
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
                onClick={() => setShowDeductionModal(true)}
              >
                Add deduction
              </button>
            </div>
            <div className="grid gap-3">
              {categories.map((cat) => (
                <div key={cat.key} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{cat.label}</p>
                    {cat.methods && <span className="text-xs text-slate-400">Methods: {cat.methods.join(", ")}</span>}
                  </div>
                  <p className="text-sm text-slate-400">{cat.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Saved deductions ({taxInputs.year})</p>
                <h2 className="text-lg font-semibold">Total ${totals.dedTotal.toFixed(0)}</h2>
              </div>
            </div>
            {filteredDeductions.length === 0 ? (
              <p className="text-sm text-slate-300">No deductions yet for this profile.</p>
            ) : (
              <div className="space-y-2">
                {filteredDeductions.map((d) => (
                  <div key={d.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between">
                    <p className="font-semibold">{d.categoryKey}</p>
                    <p className="text-sm text-slate-300">{d.date}</p>
                  </div>
                  <p className="text-sm text-slate-200">
                    ${d.amount.toFixed(2)} · Work {d.workUsePercent}%
                    {d.method ? ` · ${d.method}` : ""}
                    {d.km ? ` · ${d.km}km @ $${CENTS_PER_KM_RATE}/km` : ""}
                  </p>
                  {d.description && <p className="text-xs text-slate-400">{d.description}</p>}
                  {d.attachmentData && (
                    <img src={d.attachmentData} alt="Receipt" className="mt-2 h-24 rounded border border-white/10" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        </section>
      )}

      {tab === "gst" && profile === "uber" && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">GST entries</p>
                <h2 className="text-lg font-semibold">Sales & purchases</h2>
              </div>
              <button
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
                onClick={() => setShowGstModal(true)}
              >
                Add GST entry
              </button>
            </div>
            {gstEntries.length === 0 ? (
              <p className="text-sm text-slate-300">No GST entries yet.</p>
            ) : (
              <div className="space-y-2">
                {gstEntries.map((g) => (
                  <div key={g.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">
                        {g.type} · {g.description || "No description"}
                      </p>
                      <p className="text-sm text-slate-300">{g.date}</p>
                    </div>
                    <p className="text-sm text-slate-200">
                      ${g.amount.toFixed(2)} ({g.amountType}) · GST {g.gstAmount.toFixed(2)} · {g.gstTreatment}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card p-4 space-y-2">
            <h2 className="text-lg font-semibold">GST summary</h2>
            <p className="text-sm text-slate-300">GST on sales: ${totals.gstSales.toFixed(2)}</p>
            <p className="text-sm text-slate-300">GST on purchases (credits): ${totals.gstPurchases.toFixed(2)}</p>
            <p className="text-sm text-emerald-200">Net GST: ${(totals.gstSales - totals.gstPurchases).toFixed(2)}</p>
          </div>
        </section>
      )}

      {tab === "tax" && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4 space-y-3">
            <h2 className="text-lg font-semibold">Inputs</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="text-slate-300">
                Tax year (starts Jul 1)
                <input
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                  value={taxInputs.year}
                  onChange={(e) => setTaxInputs((p) => ({ ...p, year: e.target.value }))}
                />
              </label>
              <label className="text-slate-300">
                IT income
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                  value={taxInputs.itIncome}
                  onChange={(e) => setTaxInputs((p) => ({ ...p, itIncome: Number(e.target.value) }))}
                />
              </label>
              <label className="text-slate-300">
                Uber income
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                  value={taxInputs.uberIncome}
                  onChange={(e) => setTaxInputs((p) => ({ ...p, uberIncome: Number(e.target.value) }))}
                />
              </label>
            </div>
          </div>
          <div className="card p-4 space-y-2">
            <h2 className="text-lg font-semibold">Tax estimate</h2>
            <p className="text-sm text-slate-300">IT deductions: ${totals.dedTotal.toFixed(0)}</p>
            <p className="text-sm text-slate-300">Uber profit: ${totals.uberProfit.toFixed(0)}</p>
            <p className="text-sm text-slate-300">Taxable income: ${totals.taxable.toFixed(0)}</p>
            <p className="text-sm text-slate-300">Base tax: ${totals.baseTax.toFixed(0)}</p>
            <p className="text-sm text-slate-300">Medicare levy (2%): ${totals.levy.toFixed(0)}</p>
            <p className="text-sm text-emerald-200">Total: ${(totals.baseTax + totals.levy).toFixed(0)}</p>
          </div>
        </section>
      )}

      {showDeductionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900/90 p-6 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Add deduction</p>
                <h2 className="text-xl font-semibold">{rules[profile].name}</h2>
              </div>
              <button className="text-sm text-slate-300 hover:text-white" onClick={() => setShowDeductionModal(false)}>
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mt-4">
              <label className="text-slate-300">
                Date
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                  value={deductionForm.date}
                  onChange={(e) => setDeductionForm((p) => ({ ...p, date: e.target.value }))}
                />
              </label>
              <label className="text-slate-300">
                Category
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                  value={deductionForm.categoryKey}
                  onChange={(e) => setDeductionForm((p) => ({ ...p, categoryKey: e.target.value }))}
                >
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 text-slate-300">
                Description
                <input
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                  value={deductionForm.description}
                  onChange={(e) => setDeductionForm((p) => ({ ...p, description: e.target.value }))}
                />
              </label>
              <label className="text-slate-300">
                Amount
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                  value={deductionForm.amount}
                  onChange={(e) => setDeductionForm((p) => ({ ...p, amount: Number(e.target.value) }))}
                />
              </label>
              <label className="text-slate-300">
                Work-use %
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                  value={deductionForm.workUsePercent}
                  onChange={(e) => setDeductionForm((p) => ({ ...p, workUsePercent: Number(e.target.value) }))}
                />
              </label>
              <label className="text-slate-300 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={deductionForm.receipt}
                  onChange={(e) => setDeductionForm((p) => ({ ...p, receipt: e.target.checked }))}
                />
                Receipt kept
              </label>
              {profile === "uber" && (
                <>
                  <label className="text-slate-300">
                    GST amount type
                    <select
                      className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                      value={deductionForm.amountType ?? "inc"}
                      onChange={(e) => setDeductionForm((p) => ({ ...p, amountType: e.target.value as "inc" | "ex" }))}
                    >
                      <option value="inc">GST inclusive</option>
                      <option value="ex">GST exclusive</option>
                    </select>
                  </label>
                  <label className="text-slate-300">
                    GST treatment
                    <select
                      className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                      value={deductionForm.gstTreatment ?? "taxable"}
                      onChange={(e) =>
                        setDeductionForm((p) => ({
                          ...p,
                          gstTreatment: e.target.value as "taxable" | "gst_free" | "input_taxed"
                        }))
                      }
                    >
                      <option value="taxable">Taxable</option>
                      <option value="gst_free">GST free</option>
                      <option value="input_taxed">Input taxed</option>
                    </select>
                  </label>
                </>
              )}
              <label className="col-span-2 text-slate-300">
                Receipt image (optional)
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 w-full text-sm"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const dataUrl = evt.target?.result as string;
                      setDeductionForm((p) => ({ ...p, attachmentData: dataUrl }));
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {profile === "uber" && deductionForm.categoryKey === "car_expenses" && (
                <>
                  <label className="text-slate-300">
                    Method
                    <select
                      className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                      value={deductionForm.method ?? ""}
                      onChange={(e) => setDeductionForm((p) => ({ ...p, method: e.target.value }))}
                    >
                      <option value="">Select</option>
                      <option value="cents_per_km">Cents per km</option>
                      <option value="logbook">Logbook</option>
                    </select>
                  </label>
                  {deductionForm.method === "cents_per_km" && (
                    <label className="text-slate-300">
                      Kilometres
                      <input
                        type="number"
                        className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                        value={deductionForm.km ?? 0}
                        onChange={(e) => setDeductionForm((p) => ({ ...p, km: Number(e.target.value) }))}
                      />
                    </label>
                  )}
                </>
              )}
            </div>
            {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
            <div className="mt-4 flex items-center gap-3">
              <button
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
                onClick={saveDeduction}
              >
                Save
              </button>
              <button className="text-sm text-slate-300 hover:text-white" onClick={() => setShowDeductionModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showGstModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900/90 p-6 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Add GST entry</p>
                <h2 className="text-xl font-semibold">Uber GST</h2>
              </div>
              <button className="text-sm text-slate-300 hover:text-white" onClick={() => setShowGstModal(false)}>
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mt-4">
              <label className="text-slate-300">
                Date
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                  value={gstForm.date}
                  onChange={(e) => setGstForm((p) => ({ ...p, date: e.target.value }))}
                />
              </label>
              <label className="text-slate-300">
                Type
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                  value={gstForm.type}
                  onChange={(e) => setGstForm((p) => ({ ...p, type: e.target.value as GstEntry["type"] }))}
                >
                  <option value="sale">Sale</option>
                  <option value="purchase">Purchase</option>
                </select>
              </label>
              <label className="text-slate-300">
                Amount
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                  value={gstForm.amount}
                  onChange={(e) => setGstForm((p) => ({ ...p, amount: Number(e.target.value) }))}
                />
              </label>
              <label className="text-slate-300">
                Amount type
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                  value={gstForm.amountType}
                  onChange={(e) => setGstForm((p) => ({ ...p, amountType: e.target.value as GstEntry["amountType"] }))}
                >
                  <option value="inc">GST inclusive</option>
                  <option value="ex">GST exclusive</option>
                </select>
              </label>
              <label className="text-slate-300">
                GST treatment
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                  value={gstForm.gstTreatment}
                  onChange={(e) =>
                    setGstForm((p) => ({ ...p, gstTreatment: e.target.value as GstEntry["gstTreatment"] }))
                  }
                >
                  <option value="taxable">Taxable</option>
                  <option value="gst_free">GST free</option>
                  <option value="input_taxed">Input taxed</option>
                </select>
              </label>
              <label className="col-span-2 text-slate-300">
                Description
                <input
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm"
                  value={gstForm.description}
                  onChange={(e) => setGstForm((p) => ({ ...p, description: e.target.value }))}
                />
              </label>
              <label className="text-slate-300 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={gstForm.receipt}
                  onChange={(e) => setGstForm((p) => ({ ...p, receipt: e.target.checked }))}
                />
                Receipt kept
              </label>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
                onClick={saveGst}
              >
                Save
              </button>
              <button className="text-sm text-slate-300 hover:text-white" onClick={() => setShowGstModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
