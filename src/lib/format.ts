const gal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatGal(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return gal.format(Math.round(value));
}

export function formatMgd(gallons: number): string {
  if (!Number.isFinite(gallons)) return "—";
  return `${(gallons / 1_000_000).toFixed(3)} MGD`;
}

export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  return usd.format(Math.round(amount));
}

export function formatUsdCompact(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(amount / 1_000).toFixed(1)}k`;
  return usd.format(Math.round(amount));
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${Math.round(value / 1000)}k`;
  if (abs >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return gal.format(Math.round(value));
}

export function formatNum(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function formatPct(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatDelta(after: number, before: number, digits = 0): string {
  if (!Number.isFinite(after) || !Number.isFinite(before) || before === 0) return "—";
  const pct = (100 * (after - before)) / before;
  const sign = pct > 0.05 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}

export function weekday(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

export function shortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return utc.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function hourLabel(time: string): string {
  const hour = Number(time.slice(11, 13));
  if (Number.isNaN(hour)) return time;
  return `${String(hour).padStart(2, "0")}:00`;
}
