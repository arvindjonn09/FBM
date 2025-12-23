"use client";

import { useState } from "react";
import { downloadJSON, exportBackup, importBackup } from "../../src/lib/backup";

export default function SettingsPage() {
  const [message, setMessage] = useState<string | null>(null);

  const handleExport = async () => {
    const payload = await exportBackup();
    downloadJSON("calendar-mba-backup", payload);
    setMessage("Backup exported");
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const json = JSON.parse(text);
    await importBackup(json);
    setMessage("Backup imported");
  };

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm text-slate-400">Settings</p>
        <h1 className="text-2xl font-semibold">Backup and privacy</h1>
      </header>
      <section className="card p-5 space-y-4">
        <h2 className="text-lg font-semibold">Backup</h2>
        <p className="text-sm text-slate-300">Data stays on device. Export/import JSON to avoid loss.</p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
          >
            Export backup
          </button>
          <label className="cursor-pointer rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10">
            Import backup
            <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </label>
        </div>
        {message && <p className="text-sm text-emerald-200">{message}</p>}
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="text-lg font-semibold">App lock (optional)</h2>
        <p className="text-sm text-slate-300">
          Store a PIN in IndexedDB to lock the app on launch. Not implemented in this scaffold; hook into settings
          table to add a hashed PIN.
        </p>
      </section>
    </div>
  );
}
