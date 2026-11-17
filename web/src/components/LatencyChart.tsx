import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartData } from "../lib/demo";
import type { Range } from "../lib/demo";

export default function LatencyChart({
  range,
  percentile,
}: {
  range: Range;
  percentile: "p50" | "p95" | "p99";
}) {
  const ticks: Record<Range, string[]> = {
    "1h": ["12:00", "12:10", "12:20", "12:30", "12:40", "12:50", "13:00"],
    "24h": ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "23:59"],
    "7d": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "30d": ["Oct 19", "Oct 24", "Oct 29", "Nov 3", "Nov 8", "Nov 13", "Nov 17"],
  };
  return (
    <div
      className="latency-chart"
      role="img"
      aria-label={`Sample ${percentile} response times for ${range}, between 80 and 500 milliseconds`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData(range)}
          margin={{ top: 15, right: 10, left: -17, bottom: 0 }}
        >
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--green)" stopOpacity={0.22} />
              <stop
                offset="100%"
                stopColor="var(--green)"
                stopOpacity={0.005}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--chart-grid)"
            strokeDasharray="3 5"
            vertical={false}
          />
          <XAxis
            type="number"
            dataKey="time"
            domain={[0, 48]}
            ticks={[0, 8, 16, 24, 32, 40, 48]}
            tickFormatter={(value) =>
              ticks[range][Math.round(Number(value) / 8)] || ""
            }
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            dy={10}
          />
          <YAxis
            ticks={[0, 100, 200, 300, 400, 500]}
            domain={[0, 500]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip
            cursor={{
              stroke: "var(--green)",
              strokeDasharray: "3 3",
              opacity: 0.3,
            }}
            contentStyle={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 12,
              color: "var(--text)",
            }}
            labelFormatter={(value) => `Sample interval ${value}`}
            formatter={(value) => [`${value} ms`, percentile.toUpperCase()]}
          />
          <Area
            type="monotone"
            dataKey={percentile}
            stroke="var(--green)"
            strokeWidth={2}
            fill="url(#chart-fill)"
            animationDuration={700}
            isAnimationActive={
              !window.matchMedia("(prefers-reduced-motion: reduce)").matches
            }
            activeDot={{
              r: 4,
              fill: "var(--green)",
              stroke: "var(--surface)",
              strokeWidth: 3,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
