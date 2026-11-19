"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPct } from "@/lib/format";
import { tooltipStyle } from "./tooltip";

export function SensitivityChart({
  points,
}: {
  points: { flexible_share: number; peak_cut_pct: number }[];
}) {
  const data = points.map((p) => ({
    share: `${Math.round(p.flexible_share * 100)}%`,
    cut: Number(p.peak_cut_pct.toFixed(1)),
  }));
  return (
    <div className="h-56 w-full" role="img" aria-label="Peak-day cut against flexible share">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#e7e1d6" vertical={false} />
          <XAxis dataKey="share" tick={{ fill: "#3d5256", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: "#3d5256", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatPct(Number(value), 1), "Peak cut"]} />
          <Line type="monotone" dataKey="cut" name="Peak cut" stroke="#0e6e68" strokeWidth={2.4} dot={{ r: 4, fill: "#0e6e68" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
