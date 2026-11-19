export type SiteId = "des-moines" | "phoenix" | "lahore" | "karachi";

export type Site = {
  id: SiteId;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  timezone: string;
  grid: string;
  pakistan: boolean;
  /** One line on the site card. */
  climate: string;
  /** Why this site is in the demo. */
  why: string;
  sisterName: string;
  sisterNote: string;
  /** Days needing evaporative assist in the 11 Nov 2025 toy-year check. */
  toyEvapDays: number;
  /** Peak-day cut from time-shifting alone, same toy check. Not a dashboard result. */
  toyTimeShiftCutPct: number;
};

export type Preset = {
  id: string;
  siteId: SiteId;
  start: string;
  end: string;
  label: string;
  title: string;
  blurb: string;
  primaryKey: string;
  sisterKey: string;
};

export const SITES: Site[] = [
  {
    id: "des-moines",
    name: "Des Moines",
    region: "Iowa, United States",
    country: "United States",
    lat: 41.5868,
    lon: -93.625,
    timezone: "America/Chicago",
    grid: "MISO",
    pakistan: false,
    climate: "Humid summers. Nights usually fall through 25°C.",
    why: "West Des Moines Water Works already asks new data centers to cut peak use. This is the heat week the demo opens on.",
    sisterName: "Duluth sister",
    sisterNote:
      "A sample Upper Midwest pairing, not a real campus. Duluth is cooler, but Iowa nights are often cool enough that time-shifting does the work.",
    toyEvapDays: 112,
    toyTimeShiftCutPct: 13,
  },
  {
    id: "phoenix",
    name: "Phoenix",
    region: "Arizona, United States",
    country: "United States",
    lat: 33.4484,
    lon: -112.074,
    timezone: "America/Phoenix",
    grid: "AZPS",
    pakistan: false,
    climate: "Hot nights. Time-shifting has little room.",
    why: "The brief's toy check cut only 4% of the peak day by moving jobs inside the day. The sister site and the cooling-mode swap have to carry the rest.",
    sisterName: "Des Moines sister",
    sisterNote:
      "Sample pairing. Load moves only when the Des Moines forecast is actually cooler. Gallons avoided here are not gallons delivered there.",
    toyEvapDays: 244,
    toyTimeShiftCutPct: 4,
  },
  {
    id: "lahore",
    name: "Lahore",
    region: "Punjab, Pakistan",
    country: "Pakistan",
    lat: 31.5204,
    lon: 74.3587,
    timezone: "Asia/Karachi",
    grid: "NTDC (sample shape)",
    pakistan: true,
    climate: "Inland heat. June afternoons passed 46°C in 2025.",
    why: "A hypothetical 100 MW site on real Lahore weather. Pakistan allocated 2,000 MW for mining and AI data centers in May 2025. The water plan should come before the build-out.",
    sisterName: "Islamabad sister",
    sisterNote:
      "Sample pairing with the team's city. Islamabad is only a little cooler. Space-shifting trims Lahore's peak and shows up as water in Islamabad.",
    toyEvapDays: 254,
    toyTimeShiftCutPct: 6,
  },
  {
    id: "karachi",
    name: "Karachi",
    region: "Sindh, Pakistan",
    country: "Pakistan",
    lat: 24.8607,
    lon: 67.0011,
    timezone: "Asia/Karachi",
    grid: "NTDC (sample shape)",
    pakistan: true,
    climate: "Long hot season. Sea air, warm nights.",
    why: "The toy year needed evaporative assist on 343 days. The dry-bulb curve used here does not yet add a humidity penalty. Treat Karachi water as a lower bound.",
    sisterName: "Islamabad sister",
    sisterNote:
      "Sample pairing. Islamabad nights in late May drop under the evaporative threshold. Afternoon-to-night moves are space-shift and time-shift together.",
    toyEvapDays: 343,
    toyTimeShiftCutPct: 7,
  },
];

export const PRESETS: Preset[] = [
  {
    id: "dsm-2025-07-08",
    siteId: "des-moines",
    start: "2025-07-08",
    end: "2025-07-14",
    label: "8–14 Jul 2025",
    title: "Iowa heat week",
    blurb:
      "Open-Meteo archive. 10 July reached 33.7°C. 11 July stayed at or below 24.1°C, so the cool day is real.",
    primaryKey: "des-moines__2025-07-08",
    sisterKey: "duluth__2025-07-08",
  },
  {
    id: "dsm-2025-07-21",
    siteId: "des-moines",
    start: "2025-07-21",
    end: "2025-07-27",
    label: "21–27 Jul 2025",
    title: "Late July, fewer cool nights",
    blurb:
      "A warmer stretch. Nights stayed above 21°C, so less of the day is free of evaporation.",
    primaryKey: "des-moines__2025-07-21",
    sisterKey: "duluth__2025-07-21",
  },
  {
    id: "phx-2025-07-07",
    siteId: "phoenix",
    start: "2025-07-07",
    end: "2025-07-13",
    label: "7–13 Jul 2025",
    title: "46.9°C afternoon",
    blurb:
      "9 July peaked at 46.9°C. The coolest hour of the week was still 29.3°C, above the toy evaporative threshold.",
    primaryKey: "phoenix__2025-07-07",
    sisterKey: "des-moines__2025-07-07",
  },
  {
    id: "phx-2025-06-15",
    siteId: "phoenix",
    start: "2025-06-15",
    end: "2025-06-21",
    label: "15–21 Jun 2025",
    title: "Early summer heat",
    blurb: "Six straight days at or above 40°C. Nights did not give the scheduler a dry hour.",
    primaryKey: "phoenix__2025-06-15",
    sisterKey: "des-moines__2025-06-15",
  },
  {
    id: "lhe-2025-06-08",
    siteId: "lahore",
    start: "2025-06-08",
    end: "2025-06-14",
    label: "8–14 Jun 2025",
    title: "Lahore, 46.5°C",
    blurb:
      "Hypothetical 100 MW site, real June weather. Afternoons were 42–46.5°C and nights stayed near 30°C.",
    primaryKey: "lahore__2025-06-08",
    sisterKey: "islamabad__2025-06-08",
  },
  {
    id: "lhe-2025-05-18",
    siteId: "lahore",
    start: "2025-05-18",
    end: "2025-05-24",
    label: "18–24 May 2025",
    title: "Pre-monsoon week",
    blurb: "Another hot Lahore week, included so the Pakistan case is not a single anecdote.",
    primaryKey: "lahore__2025-05-18",
    sisterKey: "islamabad__2025-05-18",
  },
  {
    id: "khi-2025-05-26",
    siteId: "karachi",
    start: "2025-05-26",
    end: "2025-06-01",
    label: "26 May–1 Jun 2025",
    title: "Karachi heat spike",
    blurb:
      "30 May reached 38.3°C. Nights stayed around 28°C. Islamabad nights in the same week fell to 19°C.",
    primaryKey: "karachi__2025-05-26",
    sisterKey: "islamabad__2025-05-26",
  },
  {
    id: "khi-2025-06-14",
    siteId: "karachi",
    start: "2025-06-14",
    end: "2025-06-20",
    label: "14–20 Jun 2025",
    title: "Coastal June",
    blurb: "A second Karachi window. Humidity is not in the toy curve, so read this as a dry-bulb lower bound.",
    primaryKey: "karachi__2025-06-14",
    sisterKey: "islamabad__2025-06-14",
  },
];

export function siteById(id: string): Site {
  const site = SITES.find((s) => s.id === id);
  if (!site) throw new Error(`Unknown site ${id}`);
  return site;
}

export function presetsFor(siteId: string): Preset[] {
  return PRESETS.filter((p) => p.siteId === siteId);
}

export function presetById(id: string): Preset {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown preset ${id}`);
  return preset;
}

export const DEFAULT_PRESET_ID = "dsm-2025-07-08";
