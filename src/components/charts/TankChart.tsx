"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatGal } from "@/lib/format";
import { tooltipStyle } from "./tooltip";

export type TankRow = {
  label: string;
  time: string;
  level: number;
  fill: number;
  draw: number;
};

export function TankChart({ rows, capacity }: { rows: TankRow[]; capacity: number }) {
  return (
    <div className="h-60 w-full" role="img" aria-label="Hourly on-site water tank state of charge, fills, and draws">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#475569", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={rows.length > 80 ? 11 : 5}
          />
          <YAxis
            domain={[0, Math.max(1000, capacity)]}
            tickFormatter={(v) => formatCompact(Number(v))}
            tick={{ fill: "#475569", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [`${formatGal(Number(value))} gal`, String(name)]}
            labelFormatter={(_label, payload) => {
              const row = payload?.[0]?.payload as TankRow | undefined;
              return row ? row.time.replace("T", " ") : String(_label);
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
          <Area
            type="monotone"
            dataKey="level"
            name="Tank Stored Volume (gal)"
            stroke="#0D9488"
            fill="#CCFBF1"
            strokeWidth={2}
          />
          <Bar dataKey="draw" name="Tank Draw (gal/h)" fill="#EA580C" maxBarSize={8} />
          <Bar dataKey="fill" name="Tank Fill (gal/h)" fill="#0369A1" maxBarSize={8} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
