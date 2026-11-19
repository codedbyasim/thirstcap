"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatGal, formatPct } from "@/lib/format";
import { tooltipStyle } from "./tooltip";

export function SensitivityChart({
  points,
}: {
  points: { flexible_share: number; peak_cut_pct: number; peak_day_gal: number }[];
}) {
  const data = points.map((p) => ({
    share: `${Math.round(p.flexible_share * 100)}%`,
    cut: Number(p.peak_cut_pct.toFixed(1)),
    peakGal: p.peak_day_gal,
  }));

  return (
    <div className="h-60 w-full" role="img" aria-label="Peak-day water cut versus flexible compute share">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="share" tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: "#475569", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, _name, item) => {
              const row = item?.payload as { peakGal?: number } | undefined;
              const peakText = row?.peakGal != null ? ` (${formatGal(row.peakGal)} gal/day)` : "";
              return [`${formatPct(Number(value), 1)}${peakText}`, "Peak Cut"];
            }}
          />
          <Line
            type="monotone"
            dataKey="cut"
            name="Peak Cut"
            stroke="#0369A1"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#0369A1", stroke: "#FFFFFF", strokeWidth: 1.5 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
