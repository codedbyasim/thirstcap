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
  load: number;
  space: number;
  mode: string;
};

export function HourlyChart({ rows }: { rows: HourRow[] }) {
  return (
    <div className="h-72 w-full sm:h-80" role="img" aria-label="Hourly IT load and dry-bulb temperature">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows}>
          <CartesianGrid stroke="#e7e1d6" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#3d5256", fontSize: 11 }} axisLine={false} tickLine={false} interval={5} />
          <YAxis
            yAxisId="mw"
            domain={[0, 110]}
            tick={{ fill: "#3d5256", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <YAxis
            yAxisId="c"
            orientation="right"
            domain={[10, 50]}
            tick={{ fill: "#5e7276", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => {
              const n = Number(value);
              if (name === "Temperature") return [`${n.toFixed(1)}°C`, name];
              return [`${n.toFixed(1)} MW`, name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area yAxisId="mw" type="monotone" dataKey="load" name="Local IT (MW)" stroke="#0e6e68" fill="#d7efe9" strokeWidth={2} />
          <Line yAxisId="mw" type="step" dataKey="space" name="To sister (MW)" stroke="#9a3412" strokeWidth={1.5} dot={false} />
          <Line yAxisId="c" type="monotone" dataKey="temp" name="Dry-bulb (°C)" stroke="#c4a15a" strokeWidth={1.75} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
