import { db } from "./db";
import { BackupPayload } from "./types";

export async function exportBackup(): Promise<BackupPayload> {
  const [debtAccounts, schedules, occurrences] = await Promise.all([
    db.debtAccounts.toArray(),
    db.schedules.toArray(),
    db.occurrences.toArray()
  ]);
  return { debtAccounts, schedules, occurrences };
}

export async function importBackup(payload: BackupPayload) {
  await db.transaction("rw", db.debtAccounts, db.schedules, db.occurrences, async () => {
    await db.debtAccounts.clear();
    await db.schedules.clear();
    await db.occurrences.clear();
    await db.debtAccounts.bulkAdd(payload.debtAccounts);
    await db.schedules.bulkAdd(payload.schedules);
    await db.occurrences.bulkAdd(payload.occurrences);
  });
}

export function downloadJSON(name: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name.endsWith(".json") ? name : `${name}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
