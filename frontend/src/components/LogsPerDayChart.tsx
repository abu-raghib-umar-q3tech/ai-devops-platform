import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LogsPerDayPoint as ApiLogsPerDayPoint } from "../services/api";

type ChartRow = {
  dateKey: string;
  dateLabel: string;
  fullDateLabel: string;
  count: number;
};

function formatLocalLabelFromDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

function formatFullDateFromDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fromYmdKeyToLocalDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** Backend sends UTC calendar dates (YYYY-MM-DD); display in local calendar for ticks */
function buildSeriesFromApi(series: ApiLogsPerDayPoint[]): ChartRow[] {
  return series.map((row) => {
    const localDate = fromYmdKeyToLocalDate(row.date);
    return {
      dateKey: row.date,
      dateLabel: formatLocalLabelFromDate(localDate),
      fullDateLabel: formatFullDateFromDate(localDate),
      count: row.count,
    };
  });
}

function formatTick(label: string): string {
  return label;
}

export function LogsPerDayChart({
  series,
}: Readonly<{
  series: ApiLogsPerDayPoint[];
}>) {
  const data = buildSeriesFromApi(series);

  return (
    <div>
      {data.length === 0 ? (
        <div className="py-12 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            No activity data yet. Start analyzing logs to see trends.
          </p>
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} className="dark:opacity-20" />
              <XAxis
                dataKey="dateLabel"
                tickFormatter={formatTick}
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                allowDecimals={false}
                stroke="#64748b"
                style={{ fontSize: '12px' }}
                label={{ value: 'Logs', angle: -90, position: 'insideLeft', style: { fontSize: '12px', fill: '#64748b' } }}
              />
              <Tooltip
                formatter={(value) => [`${value}`, "logs"]}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.fullDateLabel ?? ""
                }
                contentStyle={{
                  backgroundColor: "#1e293b",
                  borderColor: "#475569",
                  borderRadius: "0.5rem",
                  color: "#e2e8f0",
                  fontSize: '14px',
                  padding: '8px 12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '5 5' }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

