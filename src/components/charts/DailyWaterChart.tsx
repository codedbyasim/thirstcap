"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatGal } from "@/lib/format";
import { tooltipStyle } from "./tooltip";

export type DailyRow = {
  label: string;
  date: string;
  temp: number;
  baseline: number;
  optimized: number | null;
};

export function DailyWaterChart({
  rows,
  cap,
  showOptimized,
}: {
  rows: DailyRow[];
  cap: number | null;
  showOptimized: boolean;
}) {
  return (
    <div className="h-72 w-full sm:h-80" role="img" aria-label="Daily water withdrawal, baseline and plan, with the cap">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} barGap={4} barCategoryGap="22%">
          <CartesianGrid stroke="#e7e1d6" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#3d5256", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => formatCompact(Number(v))}
            tick={{ fill: "#3d5256", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [value == null ? "—" : `${formatGal(Number(value))} gal`, String(name)]}
            labelFormatter={(_label, payload) => {
              const row = payload?.[0]?.payload as DailyRow | undefined;
              return row ? `${row.date} · max ${row.temp.toFixed(1)}°C` : String(_label);
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="baseline" name="Baseline" fill="#d4652f" radius={[5, 5, 0, 0]} maxBarSize={28} />
          {showOptimized ? (
            <Bar dataKey="optimized" name="ThirstCap" fill="#0e6e68" radius={[5, 5, 0, 0]} maxBarSize={28} />
          ) : null}
          {cap != null ? (
            <ReferenceLine
              y={cap}
              stroke="#142326"
              strokeDasharray="5 4"
              label={{ value: "Cap", position: "insideTopRight", fill: "#142326", fontSize: 11 }}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
