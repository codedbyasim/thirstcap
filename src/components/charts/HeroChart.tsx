"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact, shortDate, weekday } from "@/lib/format";
import { tooltipStyle } from "./tooltip";

export function HeroChart({ days }: { days: { date: string; baseline_gal: number; temp_max_c: number }[] }) {
  const peak = Math.max(...days.map((d) => d.baseline_gal));
  const data = days.map((d) => ({
    label: weekday(d.date),
    date: shortDate(d.date),
    gal: d.baseline_gal,
    temp: d.temp_max_c,
    hot: d.baseline_gal === peak,
  }));
  return (
    <div className="h-44 w-full" role="img" aria-label="Sample daily water for Des Moines, 8 to 14 July 2025">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="28%">
          <XAxis dataKey="label" tick={{ fill: "#3d5256", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [`${formatCompact(Number(value))} gal`, "Toy withdrawal"]}
            labelFormatter={(_l, payload) => {
              const row = payload?.[0]?.payload as { date: string; temp: number } | undefined;
              return row ? `${row.date} · ${row.temp.toFixed(1)}°C` : "";
            }}
          />
          <Bar dataKey="gal" radius={[4, 4, 0, 0]} maxBarSize={22}>
            {data.map((row) => (
              <Cell key={row.label} fill={row.hot ? "#d4652f" : "#c9b8a4"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
