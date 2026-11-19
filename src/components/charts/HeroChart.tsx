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

export type HeroDayRow = {
  day: string;
  date: string;
  tmax: number;
  baseline: number;
  milp: number;
  flex: number;
};

export function HeroChart({ rows, capGal }: { rows: HeroDayRow[]; capGal: number }) {
  return (
    <div
      className="h-56 w-full sm:h-64"
      role="img"
      aria-label="Verified CBC MILP Des Moines daily water withdrawal comparing uncontrolled baseline, normal cap plan, and flex event"
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} barGap={3} barCategoryGap="18%" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => formatCompact(Number(v))}
            tick={{ fill: "#475569", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            width={46}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [`${formatGal(Number(value))} gal`, String(name)]}
            labelFormatter={(_l, payload) => {
              const row = payload?.[0]?.payload as HeroDayRow | undefined;
              return row ? `${row.date} | max ${row.tmax.toFixed(1)}°C` : "";
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
          <Bar dataKey="baseline" name="Uncontrolled" fill="#EA580C" radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="milp" name="MILP Plan (78% Cap)" fill="#0369A1" radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="flex" name="Flex Event (-30%)" fill="#0D9488" radius={[3, 3, 0, 0]} maxBarSize={18} />
          <ReferenceLine
            y={capGal}
            stroke="#0B1F33"
            strokeDasharray="5 4"
            label={{ value: "78% Cap", position: "insideTopRight", fill: "#0B1F33", fontSize: 10, fontWeight: 600 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
