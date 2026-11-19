import weatherJson from "@/data/weather.json";
import { runSamplePlan, runSensitivity, stampPeakDates } from "@/lib/model";
import { PRESETS, siteById } from "@/lib/sites";
import {
  ApiError,
  type FleetCompareResponse,
  type GeocodeResult,
  type HealthResponse,
  type PlanRequest,
  type PlanResponse,
  type SensitivityResponse,
  type TankSizingResponse,
} from "@/lib/types";

type Bundle = Record<string, { times: string[]; temps: number[] }>;

const weather = weatherJson as Bundle;
const SAMPLE_MODEL = "sample-heuristic-toy-curve-v1";

export function apiBaseUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!url) return null;
  return url.replace(/\/$/, "");
}

/** Mock is off whenever NEXT_PUBLIC_API_URL is set and NEXT_PUBLIC_USE_MOCK is not "true". */
export function usingMock(): boolean {
  const flag = process.env.NEXT_PUBLIC_USE_MOCK;
  const url = apiBaseUrl();
  if (flag === "true") return true;
  if (flag === "false" && url) return false;
  return !url;
}

export const WEATHER_RATE_LIMIT_MESSAGE =
  "Weather provider is rate-limiting; please retry in a minute.";

export function isWeatherRateLimited(err: unknown): boolean {
  if (err instanceof ApiError) {
    return (
      err.code === "weather_rate_limited" ||
      err.status === 429 ||
      (err.status === 503 && /rate-limit/i.test(err.message)) ||
      /\b429\b/.test(err.message)
    );
  }
  if (err instanceof Error) {
    return /\b429\b/.test(err.message) || /rate-limit/i.test(err.message);
  }
  return false;
}

export function optimizerErrorText(err: unknown, fallback: string): string {
  if (isWeatherRateLimited(err)) return WEATHER_RATE_LIMIT_MESSAGE;
  return err instanceof Error ? err.message : fallback;
}

export async function getHealth(): Promise<HealthResponse> {
  if (usingMock()) {
    return { status: "ok", service: "thirstcap", version: "sample", sample: true };
  }
  return getJson<HealthResponse>("/v1/health");
}

export async function geocodeCity(query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  if (usingMock()) {
    throw new ApiError("Live city geocoding requires the FastAPI backend.", 400, "no_api_url");
  }
  const data = await getJson<{ results: GeocodeResult[] }>(
    `/v1/geocode?q=${encodeURIComponent(trimmed)}`,
  );
  return data.results ?? [];
}

export async function runPlan(request: PlanRequest): Promise<PlanResponse> {
  if (usingMock()) return samplePlan(request);
  const plan = await postJson<PlanResponse>("/v1/plan", request);
  if (plan.meta?.sample) {
    plan.meta.label = `Backend marked this payload as sample. ${plan.meta.label ?? ""}`.trim();
  }
  return plan;
}

export async function runSensitivityCall(request: PlanRequest): Promise<SensitivityResponse> {
  if (usingMock()) return sampleSensitivity(request);
  return postJson<SensitivityResponse>("/v1/sensitivity", request);
}

export async function runTankSizing(request: PlanRequest): Promise<TankSizingResponse> {
  if (usingMock()) {
    throw new ApiError("Tank ROI sweep requires the live FastAPI CBC MILP service.", 400, "no_api_url");
  }
  return postJson<TankSizingResponse>("/v1/tank-sizing", request);
}

export async function runFleetCompare(request: PlanRequest): Promise<FleetCompareResponse> {
  if (usingMock()) {
    throw new ApiError("Multi-basin fleet comparison requires the live FastAPI CBC MILP service.", 400, "no_api_url");
  }
  return postJson<FleetCompareResponse>("/v1/fleet-compare", request);
}

export async function downloadPlanCsv(request: PlanRequest): Promise<void> {
  const base = apiBaseUrl();
  if (!base || usingMock()) {
    throw new ApiError("CSV export requires the FastAPI optimizer backend.", 400, "no_api_url");
  }
  const resp = await fetch(`${base}/v1/export/csv`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/csv" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(90_000),
  });
  if (!resp.ok) {
    throw new ApiError("Failed to export CSV telemetry.", resp.status, "export_failed");
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `thirstcap_${request.site_id}_${request.start}_${request.end}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function samplePlan(request: PlanRequest): PlanResponse {
  const preset = findPreset(request);
  const site = siteById(request.site_id);
  const primary = weather[preset.primaryKey];
  const sister = weather[preset.sisterKey];
  if (!primary || !sister) throw new ApiError("Weather bundle is missing this week.", 500, "missing_weather");
  const plan = runSamplePlan({
    times: primary.times,
    tempC: primary.temps,
    sisterTempC: sister.temps,
    sisterName: site.sisterName,
    request,
  });
  plan.meta.model = SAMPLE_MODEL;
  plan.meta.sample = true;
  return stampPeakDates(plan);
}

function sampleSensitivity(request: PlanRequest): SensitivityResponse {
  const preset = findPreset(request);
  const site = siteById(request.site_id);
  const primary = weather[preset.primaryKey];
  const sister = weather[preset.sisterKey];
  if (!primary || !sister) throw new ApiError("Weather bundle is missing this week.", 500, "missing_weather");
  return runSensitivity({
    times: primary.times,
    tempC: primary.temps,
    sisterTempC: sister.temps,
    sisterName: site.sisterName,
    request,
  });
}

function findPreset(request: PlanRequest) {
  const preset = PRESETS.find(
    (p) => p.siteId === request.site_id && p.start === request.start && p.end === request.end,
  );
  if (!preset) {
    throw new ApiError(
      `No bundled week for ${request.site_id} ${request.start} to ${request.end}.`,
      404,
      "unknown_preset",
    );
  }
  return preset;
}

async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: "GET" });
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const base = apiBaseUrl();
  if (!base) throw new ApiError("NEXT_PUBLIC_API_URL is not set.", 0, "no_api_url");
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    throw new ApiError(`Cannot reach ThirstCap optimizer at ${base}: ${message}`, 0, "network");
  }
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError("Optimizer returned a non-JSON body.", response.status, "bad_json");
    }
  }
  if (!response.ok) {
    const body = data as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(
      body?.error?.message || response.statusText || "Optimizer request failed",
      response.status,
      body?.error?.code || "http_error",
    );
  }
  return data as T;
}
