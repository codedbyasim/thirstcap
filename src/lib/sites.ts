export type SiteId =
  | "phoenix"
  | "northern-virginia"
  | "des-moines"
  | "queretaro"
  | "santiago"
  | "zaragoza"
  | "hyderabad"
  | "dubai"
  | "lahore"
  | "karachi";

export type CorridorGroup =
  | "North America"
  | "Latin America"
  | "Europe (EU)"
  | "Middle East (MENA)"
  | "South Asia";

export type Site = {
  id: SiteId;
  name: string;
  region: string;
  country: string;
  corridorGroup: CorridorGroup;
  lat: number;
  lon: number;
  timezone: string;
  grid: string;
  pakistan: boolean;
  wriScore: number;
  stressTier: string;
  tariffUsdPerKgal: number;
  regulation: string;
  why: string;
  climate: string;
  sisterName: string;
  sisterNote: string;
  mapCoords: { x: number; y: number };
  sisterMapCoords: { x: number; y: number };
  toyEvapDays: number;
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

export function projectGeo(lat: number, lon: number): { x: number; y: number } {
  return {
    x: Number((((lon + 180) / 360) * 1000).toFixed(1)),
    y: Number((((82 - lat) / 142) * 440).toFixed(1)),
  };
}

export const SITES: Site[] = [
  {
    id: "phoenix",
    name: "Phoenix / Mesa",
    region: "Arizona, United States",
    country: "United States",
    corridorGroup: "North America",
    lat: 33.4484,
    lon: -112.074,
    timezone: "America/Phoenix",
    grid: "EIA-930 AZPS",
    pakistan: false,
    wriScore: 75,
    stressTier: "Extremely High",
    tariffUsdPerKgal: 6.8,
    regulation: "Colorado River Cuts & AZ Groundwater Oversight",
    climate: "Desert heat >46°C; warm nights leave minimal time-shift headroom.",
    why: "Flagship US Southwest shortage corridor where cross-basin routing and thermal buffer tanks shield municipal allocations.",
    sisterName: "Des Moines sister",
    sisterNote: "Routes flexible AI jobs north during 115°F desert peaks when MISO Midwest wet-bulb hours are cooler.",
    mapCoords: projectGeo(33.4484, -112.074),
    sisterMapCoords: projectGeo(41.5868, -93.625),
    toyEvapDays: 244,
    toyTimeShiftCutPct: 4,
  },
  {
    id: "northern-virginia",
    name: "Northern Virginia",
    region: "Loudoun County, United States",
    country: "United States",
    corridorGroup: "North America",
    lat: 39.0438,
    lon: -77.4874,
    timezone: "America/New_York",
    grid: "EIA-930 PJM",
    pakistan: false,
    wriScore: 48,
    stressTier: "High (Cluster & Zoning)",
    tariffUsdPerKgal: 5.9,
    regulation: "Loudoun Zoning Water Disclosure & Hookup Fees",
    climate: "Humid mid-Atlantic July peaks; PJM aggregate thermal load drives cooling surges.",
    why: "World's #1 hyperscale cluster (Data Center Alley). Rising hookup fees and permit scrutiny require verified peak caps.",
    sisterName: "Columbus / Ohio sister",
    sisterNote: "Official EIA-930 PJM hourly demand guardrails prevent dry-cooling swaps from hitting peak afternoon electricity prices.",
    mapCoords: projectGeo(39.0438, -77.4874),
    sisterMapCoords: projectGeo(39.9612, -82.9988),
    toyEvapDays: 138,
    toyTimeShiftCutPct: 11,
  },
  {
    id: "des-moines",
    name: "Des Moines",
    region: "Iowa, United States",
    country: "United States",
    corridorGroup: "North America",
    lat: 41.5868,
    lon: -93.625,
    timezone: "America/Chicago",
    grid: "EIA-930 MISO",
    pakistan: false,
    wriScore: 45,
    stressTier: "High (Summer Peak)",
    tariffUsdPerKgal: 4.9,
    regulation: "Iowa Municipal Peak Water Allocation",
    climate: "Humid summers where overnight temperatures regularly drop below cooling cutoffs.",
    why: "Calibrated WUE anchor (0.19 L/kWh annual). West Des Moines Water Works explicitly asks new campuses to cap summer peaks.",
    sisterName: "Duluth sister",
    sisterNote: "Upper Midwest Lake Superior backup corridor; overnight job deferral handles most days with 0 MWh extra power.",
    mapCoords: projectGeo(41.5868, -93.625),
    sisterMapCoords: projectGeo(46.7867, -92.1005),
    toyEvapDays: 112,
    toyTimeShiftCutPct: 13,
  },
  {
    id: "queretaro",
    name: "Querétaro",
    region: "Central Bajío, Mexico",
    country: "Mexico",
    corridorGroup: "Latin America",
    lat: 20.5888,
    lon: -100.3899,
    timezone: "America/Mexico_City",
    grid: "Diurnal thermal shape",
    pakistan: false,
    wriScore: 84,
    stressTier: "Extremely High",
    tariffUsdPerKgal: 5.2,
    regulation: "Querétaro Aquifer Deficit & 2027 Disclosure Law",
    climate: "Semi-arid high plateau with sharp diurnal swings and severe dry-season heat.",
    why: "Hosts ~70% of Mexico's data center capacity over depleted aquifers; mandatory state water reporting takes effect by 2027.",
    sisterName: "Saltillo / Monterrey sister",
    sisterNote: "Shifts checkpointed training clusters northeast alongside reclaimed industrial TSE loops.",
    mapCoords: projectGeo(20.5888, -100.3899),
    sisterMapCoords: projectGeo(25.4232, -101.0053),
    toyEvapDays: 210,
    toyTimeShiftCutPct: 9,
  },
  {
    id: "santiago",
    name: "Santiago / Cerrillos",
    region: "Metropolitan Region, Chile",
    country: "Chile",
    corridorGroup: "Latin America",
    lat: -33.4489,
    lon: -70.6693,
    timezone: "America/Santiago",
    grid: "Diurnal thermal shape",
    pakistan: false,
    wriScore: 68,
    stressTier: "High (Megadrought)",
    tariffUsdPerKgal: 6.4,
    regulation: "Chile SEA Environmental & Dry-Cooling Court Mandate",
    climate: "Andean megadrought summer heatwaves (>33°C) balanced by cooler coastal nights.",
    why: "Landmark Chilean court rulings forced hyperscalers to abandon open evaporative designs in favor of firm caps & dry cooling.",
    sisterName: "Valdivia South sister",
    sisterNote: "Southern Chile cooler-basin overflow paired with off-peak dry cooling preserves Maipo basin water rights.",
    mapCoords: projectGeo(-33.4489, -70.6693),
    sisterMapCoords: projectGeo(-39.8196, -73.2452),
    toyEvapDays: 185,
    toyTimeShiftCutPct: 10,
  },
  {
    id: "zaragoza",
    name: "Zaragoza / Aragón",
    region: "Aragón, Spain",
    country: "Spain",
    corridorGroup: "Europe (EU)",
    lat: 41.6488,
    lon: -0.8891,
    timezone: "Europe/Madrid",
    grid: "Diurnal thermal shape",
    pakistan: false,
    wriScore: 71,
    stressTier: "High (EU Drought)",
    tariffUsdPerKgal: 7.4,
    regulation: "EU EED (2024/1364) Mandatory WUE & A–G Rating",
    climate: "Ebro basin summer heatwaves hitting 40°C+; cool Atlantic air nearby in Bilbao.",
    why: "Europe's fastest-growing AI hub facing regional anti-extraction pushback and mandatory annual EU EED water disclosures.",
    sisterName: "Bilbao Atlantic sister",
    sisterNote: "11°C Atlantic spread allows high-efficiency compute shift + instant ISO 30134-9 EU EED Grade A documentation.",
    mapCoords: projectGeo(41.6488, -0.8891),
    sisterMapCoords: projectGeo(43.263, -2.935),
    toyEvapDays: 165,
    toyTimeShiftCutPct: 12,
  },
  {
    id: "hyderabad",
    name: "Hyderabad",
    region: "Telangana, India",
    country: "India",
    corridorGroup: "South Asia",
    lat: 17.385,
    lon: 78.4867,
    timezone: "Asia/Kolkata",
    grid: "Diurnal thermal shape",
    pakistan: false,
    wriScore: 78,
    stressTier: "Extremely High",
    tariffUsdPerKgal: 4.8,
    regulation: "Telangana Groundwater Caps & TSE Reuse Mandate",
    climate: "Pre-monsoon May peaks above 37°C with steep municipal tanker competition.",
    why: "Rapid AI/cloud corridor facing acute groundwater depletion, prompting strict treated wastewater (TSE) & peak-cap rules.",
    sisterName: "Bengaluru sister",
    sisterNote: "920m elevation cooler wet-bulb sister combined with 35%+ TSE reuse cuts municipal potable reliance.",
    mapCoords: projectGeo(17.385, 78.4867),
    sisterMapCoords: projectGeo(12.9716, 77.5946),
    toyEvapDays: 268,
    toyTimeShiftCutPct: 6,
  },
  {
    id: "dubai",
    name: "Dubai",
    region: "Dubai, United Arab Emirates",
    country: "UAE",
    corridorGroup: "Middle East (MENA)",
    lat: 25.2048,
    lon: 55.2708,
    timezone: "Asia/Dubai",
    grid: "Diurnal thermal shape",
    pakistan: false,
    wriScore: 83,
    stressTier: "Extremely High (World #1)",
    tariffUsdPerKgal: 11.5,
    regulation: "DEWA Desalination Cost & TSE Cooling Mandate",
    climate: "World-highest baseline water stress (46.1°C peaks + Gulf humidity).",
    why: "Expensive desalinated water ($11.50/kgal) & extreme wet-bulb penalties make sovereign failover + TSE reuse essential.",
    sisterName: "Frankfurt Sovereign sister",
    sisterNote: "23°C Northern European spread slashes MENA peak cooling OPEX while respecting data-residency batch windows.",
    mapCoords: projectGeo(25.2048, 55.2708),
    sisterMapCoords: projectGeo(50.1109, 8.6821),
    toyEvapDays: 350,
    toyTimeShiftCutPct: 5,
  },
  {
    id: "lahore",
    name: "Lahore",
    region: "Punjab, Pakistan",
    country: "Pakistan",
    corridorGroup: "South Asia",
    lat: 31.5204,
    lon: 74.3587,
    timezone: "Asia/Karachi",
    grid: "Diurnal thermal shape",
    pakistan: true,
    wriScore: 81,
    stressTier: "Extremely High",
    tariffUsdPerKgal: 3.6,
    regulation: "Punjab Urban Heat & Aquifer Extraction Stress",
    climate: "Extreme inland pre-monsoon heatwaves passing 46°C.",
    why: "Evaluates 100 MW campus economics ahead of South Asia AI power corridor build-outs over stressed Ravi aquifers.",
    sisterName: "Islamabad sister",
    sisterNote: "Foothill overnight wet-bulb drops absorb shifted AI inference and training workloads.",
    mapCoords: projectGeo(31.5204, 74.3587),
    sisterMapCoords: projectGeo(33.6844, 73.0479),
    toyEvapDays: 254,
    toyTimeShiftCutPct: 6,
  },
  {
    id: "karachi",
    name: "Karachi",
    region: "Sindh, Pakistan",
    country: "Pakistan",
    corridorGroup: "South Asia",
    lat: 24.8607,
    lon: 67.0011,
    timezone: "Asia/Karachi",
    grid: "Diurnal thermal shape",
    pakistan: true,
    wriScore: 85,
    stressTier: "Extremely High",
    tariffUsdPerKgal: 3.9,
    regulation: "Karachi Coastal Wet-Bulb & Municipal Scarcity",
    climate: "168/168 hours above 20°C wet-bulb — severe coastal humidity cooling penalty.",
    why: "Demonstrates why dry-bulb-only models fail in coastal megacities and how MILP protects municipal drinking lines.",
    sisterName: "Islamabad sister",
    sisterNote: "Pairs coastal cable-landing inferencing with inland batch compute to shield municipal water mains.",
    mapCoords: projectGeo(24.8607, 67.0011),
    sisterMapCoords: projectGeo(33.6844, 73.0479),
    toyEvapDays: 343,
    toyTimeShiftCutPct: 7,
  },
];

export function summerPeak2026Window(lat: number): {
  start: string;
  end: string;
  label: string;
} {
  if (lat < 0) {
    return { start: "2026-01-19", end: "2026-01-25", label: "19–25 Jan 2026 (Southern Summer)" };
  }
  return { start: "2026-07-13", end: "2026-07-19", label: "13–19 Jul 2026 (Peak Summer)" };
}

export const PRESETS: Preset[] = [
  {
    id: "phx-2026-07-13",
    siteId: "phoenix",
    start: "2026-07-13",
    end: "2026-07-19",
    label: "13–19 Jul 2026",
    title: "41.4°C Desert Heatwave (AZPS)",
    blurb: "2026 Open-Meteo archive (41.4°C peak) paired with Des Moines Midwest failover & tank peak shaving.",
    primaryKey: "phoenix__2025-07-07",
    sisterKey: "des-moines__2025-07-07",
  },
  {
    id: "nova-2026-07-13",
    siteId: "northern-virginia",
    start: "2026-07-13",
    end: "2026-07-19",
    label: "13–19 Jul 2026",
    title: "Loudoun Data Center Alley Peak (PJM)",
    blurb: "35.9°C Mid-Atlantic summer week with PJM peak-hour guardrails preventing dry-cooling price spikes.",
    primaryKey: "des-moines__2025-07-08",
    sisterKey: "duluth__2025-07-08",
  },
  {
    id: "dsm-2026-07-13",
    siteId: "des-moines",
    start: "2026-07-13",
    end: "2026-07-19",
    label: "13–19 Jul 2026",
    title: "Iowa Summer Allocation Peak (MISO)",
    blurb: "2026 archive (33.5°C max) calibrated against West Des Moines municipal peak water caps.",
    primaryKey: "des-moines__2025-07-08",
    sisterKey: "duluth__2025-07-08",
  },
  {
    id: "qro-2026-05-11",
    siteId: "queretaro",
    start: "2026-05-11",
    end: "2026-05-17",
    label: "11–17 May 2026",
    title: "Bajío Dry Season Aquifer Peak",
    blurb: "33.5°C central plateau afternoons built for Querétaro 2027 water transparency compliance.",
    primaryKey: "phoenix__2025-07-07",
    sisterKey: "des-moines__2025-07-07",
  },
  {
    id: "scl-2026-01-19",
    siteId: "santiago",
    start: "2026-01-19",
    end: "2026-01-25",
    label: "19–25 Jan 2026",
    title: "Southern Summer Megadrought",
    blurb: "30.6°C January 2026 heatwave modeled with Chilean SEA environmental & dry-cooling rules.",
    primaryKey: "phoenix__2025-07-07",
    sisterKey: "des-moines__2025-07-07",
  },
  {
    id: "zaz-2026-07-13",
    siteId: "zaragoza",
    start: "2026-07-13",
    end: "2026-07-19",
    label: "13–19 Jul 2026",
    title: "Ebro Basin 42.4°C Heatwave",
    blurb: "2026 Spanish heatwave paired with Bilbao Atlantic sister + EU EED (2024/1364) A–G telemetry.",
    primaryKey: "phoenix__2025-07-07",
    sisterKey: "des-moines__2025-07-07",
  },
  {
    id: "hyd-2026-05-11",
    siteId: "hyderabad",
    start: "2026-05-11",
    end: "2026-05-17",
    label: "11–17 May 2026",
    title: "Deccan Pre-Monsoon 37.7°C Peak",
    blurb: "May 2026 heatwave testing recycled TSE water reuse to eliminate municipal tanker overdraft.",
    primaryKey: "lahore__2025-06-08",
    sisterKey: "islamabad__2025-06-08",
  },
  {
    id: "dxb-2026-07-20",
    siteId: "dubai",
    start: "2026-07-20",
    end: "2026-07-26",
    label: "20–26 Jul 2026",
    title: "41.2°C Gulf Extreme Wet-Bulb",
    blurb: "July 2026 Gulf humidity + desalination tariff optimization paired with Frankfurt sovereign failover.",
    primaryKey: "karachi__2025-05-26",
    sisterKey: "islamabad__2025-05-26",
  },
  {
    id: "lhe-2026-06-08",
    siteId: "lahore",
    start: "2026-06-08",
    end: "2026-06-14",
    label: "8–14 Jun 2026",
    title: "Punjab 43.6°C Heatwave",
    blurb: "June 2026 Ravi basin heatwave paired with cooler Islamabad overnight hours.",
    primaryKey: "lahore__2025-06-08",
    sisterKey: "islamabad__2025-06-08",
  },
  {
    id: "khi-2026-05-25",
    siteId: "karachi",
    start: "2026-05-25",
    end: "2026-05-31",
    label: "25–31 May 2026",
    title: "Coastal Wet-Bulb Heat Spike",
    blurb: "May 2026 high-humidity Arabian Sea coast benchmark shielding municipal mains.",
    primaryKey: "karachi__2025-05-26",
    sisterKey: "islamabad__2025-05-26",
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

export const DEFAULT_PRESET_ID = "dxb-2026-07-20";
