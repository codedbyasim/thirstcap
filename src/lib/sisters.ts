import type { SiteId } from "@/lib/sites";

/** Sister coordinates from the backend site registry. */
export const SITE_SISTERS: Record<SiteId, { name: string; lat: number; lon: number }> = {
  phoenix: { name: "Des Moines sister", lat: 41.5868, lon: -93.625 },
  "northern-virginia": { name: "Columbus / Ohio sister", lat: 39.9612, lon: -82.9988 },
  "des-moines": { name: "Duluth sister", lat: 46.7867, lon: -92.1005 },
  queretaro: { name: "Saltillo / Monterrey sister", lat: 25.4232, lon: -101.0053 },
  santiago: { name: "Valdivia South sister", lat: -39.8196, lon: -73.2452 },
  zaragoza: { name: "Bilbao Atlantic sister", lat: 43.263, lon: -2.935 },
  hyderabad: { name: "Bengaluru sister", lat: 12.9716, lon: 77.5946 },
  dubai: { name: "Frankfurt Sovereign sister", lat: 50.1109, lon: 8.6821 },
  lahore: { name: "Islamabad sister", lat: 33.6844, lon: 73.0479 },
  karachi: { name: "Islamabad sister", lat: 33.6844, lon: 73.0479 },
};

/** Same regional pairing the API uses in `_pick_custom_sister`. */
export function guessSister(lat: number, lon: number): { name: string; lat: number; lon: number } {
  if (lon < -50 && lat >= 15) return { name: "Duluth Great Lakes sister", lat: 46.7867, lon: -92.1005 };
  if (lon < -30 && lat < 15) return { name: "Valdivia South sister", lat: -39.8196, lon: -73.2452 };
  if (lon >= -15 && lon <= 40 && lat >= 35) return { name: "Oslo Nordic sister", lat: 59.9139, lon: 10.7522 };
  if (lon >= -20 && lon <= 62 && lat < 35) return { name: "Zurich Alpine sister", lat: 47.3769, lon: 8.5417 };
  if (lon > 62 && lon <= 92 && lat >= 5) return { name: "Islamabad Foothill sister", lat: 33.6844, lon: 73.0479 };
  if (lon > 92 && lat >= 0) return { name: "Sapporo Cool-North sister", lat: 43.0618, lon: 141.3545 };
  if (lon > 92 && lat < 0) return { name: "Hobart Tasmania sister", lat: -42.8821, lon: 147.3272 };
  return { name: "Zurich Alpine sister", lat: 47.3769, lon: 8.5417 };
}

export function wriColor(score: number): string {
  if (score >= 80) return "#fb7185";
  if (score >= 70) return "#fb923c";
  if (score >= 55) return "#fbbf24";
  return "#38bdf8";
}
