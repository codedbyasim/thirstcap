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
    <div
      className="h-72 w-full sm:h-80"
      role="img"
      aria-label="Daily utility water withdrawal comparing uncontrolled baseline against ThirstCap MILP and firm daily cap"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} barGap={4} barCategoryGap="22%" margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => formatCompact(Number(v))}
            tick={{ fill: "#475569", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [value == null ? "—" : `${formatGal(Number(value))} gal`, String(name)]}
            labelFormatter={(_label, payload) => {
              const row = payload?.[0]?.payload as DailyRow | undefined;
              return row ? `${row.date} | max ${row.temp.toFixed(1)}°C` : String(_label);
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
          <Bar dataKey="baseline" name="Uncontrolled Baseline" fill="#EA580C" radius={[3, 3, 0, 0]} maxBarSize={28} />
          {showOptimized ? (
            <Bar dataKey="optimized" name="ThirstCap MILP" fill="#0369A1" radius={[3, 3, 0, 0]} maxBarSize={28} />
          ) : null}
          {cap != null ? (
            <ReferenceLine
              y={cap}
              stroke="#0B1F33"
              strokeWidth={1.75}
              strokeDasharray="6 4"
              label={{
                value: `Cap ${formatCompact(cap)}`,
                position: "insideTopRight",
                fill: "#0B1F33",
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
