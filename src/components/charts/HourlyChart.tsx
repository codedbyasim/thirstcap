"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { tooltipStyle } from "./tooltip";

export type HourRow = {
  label: string;
  time: string;
  temp: number;
  wetBulb: number;
  load: number;
  space: number;
  mode: string;
};

export function HourlyChart({ rows, itCap = 100 }: { rows: HourRow[]; itCap?: number }) {
  const mwMax = Math.ceil(itCap * 1.1);
  return (
    <div
      className="h-72 w-full sm:h-80"
      role="img"
      aria-label="Hourly local IT load, sister space-shift load, dry-bulb temperature, and wet-bulb temperature"
    >
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
            yAxisId="mw"
            domain={[0, mwMax]}
            tick={{ fill: "#475569", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <YAxis
            yAxisId="c"
            orientation="right"
            domain={[5, 50]}
            tick={{ fill: "#64748B", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => {
              const n = Number(value);
              if (String(name).includes("°C")) return [`${n.toFixed(1)} °C`, String(name)];
              return [`${n.toFixed(1)} MW`, String(name)];
            }}
            labelFormatter={(_label, payload) => {
              const row = payload?.[0]?.payload as HourRow | undefined;
              return row ? `${row.time.replace("T", " ")} (${row.mode})` : String(_label);
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
          <Area
            yAxisId="mw"
            type="monotone"
            dataKey="load"
            name="Local IT (MW)"
            stroke="#0369A1"
            fill="#E0F2FE"
            strokeWidth={2}
          />
          <Line
            yAxisId="mw"
            type="stepAfter"
            dataKey="space"
            name="Sent to Sister (MW)"
            stroke="#B45309"
            strokeWidth={1.75}
            dot={false}
          />
          <Line
            yAxisId="c"
            type="monotone"
            dataKey="temp"
            name="Dry-Bulb (°C)"
            stroke="#EA580C"
            strokeWidth={1.75}
            dot={false}
          />
          <Line
            yAxisId="c"
            type="monotone"
            dataKey="wetBulb"
            name="Wet-Bulb (°C)"
            stroke="#0D9488"
            strokeWidth={1.75}
            strokeDasharray="4 3"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
