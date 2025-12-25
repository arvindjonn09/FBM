const monthMap: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
};

const pad = (n: number) => n.toString().padStart(2, "0");

const validIso = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && !isNaN(Date.parse(iso));

export function toDisplay(iso: string) {
  if (!iso || !validIso(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export function toISOFromDisplay(display: string) {
  const parts = display.split(/[-/]/);
  if (parts.length !== 3) return "";
  const [d, m, y] = parts.map((p) => p.trim());
  const iso = `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return validIso(iso) ? iso : "";
}

export function toISO(input: string, source: "commbank" | "stgeorge") {
  const cleaned = input.trim().replace(/\s+/g, " ");
  const parts = cleaned.split(" ");
  if (parts.length < 2) return "";
  const day = Number(parts[0]);
  const month = monthMap[parts[1].toLowerCase()] ?? 0;
  if (!day || !month) return "";
  const now = new Date();
  const currentYear = now.getFullYear();
  const iso = `${currentYear}-${pad(month)}-${pad(day)}`;
  return validIso(iso) ? iso : "";
}
