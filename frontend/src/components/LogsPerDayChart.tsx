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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Logs per day</h2>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No logs yet.
        </p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="2 4" stroke="#94a3b8" opacity={0.3} />
              <XAxis dataKey="dateLabel" tickFormatter={formatTick} />
              <YAxis allowDecimals={false} />
              <Tooltip
                formatter={(value) => [`${value}`, "logs"]}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.fullDateLabel ?? ""
                }
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "0.5rem",
                  color: "#e2e8f0",
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 1 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

