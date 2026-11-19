"use client";

import { useState } from "react";
import { formatGal, formatNum, shortDate, weekday } from "@/lib/format";
import type { HourPoint } from "@/lib/types";

export function DispatchMatrix({ hours }: { hours: HourPoint[] }) {
  const [selectedIdx, setSelectedIdx] = useState<number>(() => {
    if (hours.length === 0) return 0;
    let maxIdx = 0;
    for (let i = 1; i < hours.length; i += 1) {
      if (hours[i].temp_c > hours[maxIdx].temp_c) maxIdx = i;
    }
    return maxIdx;
  });

  const days: { date: string; cells: { hour: HourPoint; index: number }[] }[] = [];
  for (let d = 0; d < hours.length; d += 24) {
    const slice = hours.slice(d, d + 24);
    if (slice.length === 0) break;
    days.push({
      date: slice[0].time.slice(0, 10),
      cells: slice.map((hour, hIdx) => ({ hour, index: d + hIdx })),
    });
  }

  const activeHour = hours[Math.min(selectedIdx, Math.max(0, hours.length - 1))];

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[600px]">
          <div className="mb-1 grid grid-cols-[88px_repeat(24,minmax(0,1fr))] gap-1 text-[10px] font-medium text-marine-faint">
            <span className="pl-1">Day</span>
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="num text-center">
                {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
              </span>
            ))}
          </div>

          <div className="space-y-1">
            {days.map((day) => (
              <div key={day.date} className="grid grid-cols-[88px_repeat(24,minmax(0,1fr))] items-center gap-1">
                <span className="truncate pl-1 text-xs font-medium text-marine-muted">
                  {weekday(day.date)} {shortDate(day.date)}
                </span>
                {day.cells.map(({ hour, index }) => {
                  const shiftedOut = hour.time_shift_out_mw + hour.space_shift_out_mw > 0.5;
                  const isSelected = index === selectedIdx;
                  const bg = cellColor(hour);
                  return (
                    <button
                      key={hour.time}
                      type="button"
                      onClick={() => setSelectedIdx(index)}
                      aria-label={`${hour.time.replace("T", " ")}, ${hour.temp_c}°C, ${hour.cooling_mode}, ${hour.load_mw} MW`}
                      title={`${hour.time.replace("T", " ")} | ${hour.temp_c}°C | ${hour.cooling_mode} | ${hour.load_mw} MW`}
                      className={`h-7 rounded-sm transition-transform focus-visible:z-10 ${
                        isSelected ? "ring-2 ring-marine ring-offset-1" : "hover:scale-105"
                      }`}
                      style={{
                        backgroundColor: bg,
                        boxShadow: shiftedOut ? "inset 0 0 0 1.5px #0B1F33" : undefined,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-marine-muted">
        <LegendItem color="#E0F2FE" label="Dry (≤25°C, free)" />
        <LegendItem color="#FDBA74" label="Evaporative / Chiller" />
        <LegendItem color="#EA580C" label="Hot Peak (>35°C)" />
        <LegendItem color="#FBBF24" label="Forced Dry Swap (+0.15 PUE)" />
        <LegendItem color="transparent" label="Dark border: flexible IT shifted out" ring />
      </div>

      {/* Hour Inspector Strip */}
      {activeHour ? (
        <div className="grid grid-cols-2 gap-2 rounded-md border border-line bg-subtle/70 p-3 text-xs sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Selected Hour" value={activeHour.time.replace("T", " ")} />
          <Stat
            label="Dry / Wet-Bulb"
            value={`${activeHour.temp_c.toFixed(1)}° / ${(activeHour.wet_bulb_c ?? 0).toFixed(1)}°C (${Math.round(activeHour.rh_pct ?? 50)}% RH)`}
          />
          <Stat label="Local / Base IT" value={`${activeHour.load_mw.toFixed(1)} / ${activeHour.baseline_load_mw.toFixed(1)} MW`} />
          <Stat
            label="Shifted (Time / Space)"
            value={`+${activeHour.time_shift_in_mw.toFixed(1)} / -${activeHour.space_shift_out_mw.toFixed(1)} MW`}
          />
          <Stat
            label="Utility / Tank Level"
            value={`${formatGal(activeHour.utility_gal)} / ${formatGal(activeHour.tank_level_gal ?? 0)} gal`}
          />
          <Stat
            label="Grid Stress"
            value={
              activeHour.grid_demand_mw != null
                ? `${formatGal(activeHour.grid_demand_mw)} MW${activeHour.grid_peak ? " (PEAK)" : ""}`
                : `${formatNum(activeHour.grid_stress * 100, 0)}%${activeHour.grid_peak ? " (PEAK)" : ""}`
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function cellColor(hour: HourPoint): string {
  if (hour.cooling_mode === "swap") return "#FBBF24";
  if (hour.cooling_mode === "dry") return "#E0F2FE";
  const t = Math.max(0, Math.min(1, (hour.temp_c - 25) / 18));
  const r = Math.round(253 + (234 - 253) * t);
  const g = Math.round(215 + (88 - 215) * t);
  const b = Math.round(170 + (12 - 170) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function LegendItem({ color, label, ring = false }: { color: string; label: string; ring?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-3 rounded-sm border border-line"
        style={{ backgroundColor: color, boxShadow: ring ? "inset 0 0 0 1.5px #0B1F33" : undefined }}
      />
      <span>{label}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[11px] text-marine-faint">{label}</span>
      <span className="num font-semibold text-marine">{value}</span>
    </div>
  );
}
