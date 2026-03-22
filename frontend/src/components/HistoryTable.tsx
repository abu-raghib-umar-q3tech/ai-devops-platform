import type { HistoryItem } from "../services/api";
import { CodeSnippet } from "./CodeSnippet";

type HistoryTableProps = {
  rows: HistoryItem[];
  loading: boolean;
  /** Skeleton rows while loading (match page size for consistent layout) */
  skeletonRowCount?: number;
  onRowClick?: (row: HistoryItem) => void;
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get(
    "minute"
  )} ${get("dayPeriod").toUpperCase()}`;
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-600 ${className ?? ""}`}
      aria-hidden
    />
  );
}

function HistoryRowSkeleton() {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-800">
      <td className="max-w-xs px-4 py-3 align-top">
        <SkeletonBlock className="h-16 w-full min-h-[4rem]" />
      </td>
      <td className="max-w-xs px-4 py-3 align-top">
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="mt-2 h-3 w-4/5 max-w-[12rem]" />
      </td>
      <td className="max-w-xs px-4 py-3 align-top">
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="mt-2 h-3 w-3/5 max-w-[10rem]" />
      </td>
      <td className="px-4 py-3 align-top">
        <SkeletonBlock className="h-4 w-28" />
      </td>
    </tr>
  );
}

export function HistoryTable({
  rows,
  loading,
  skeletonRowCount = 10,
  onRowClick,
}: Readonly<HistoryTableProps>) {
  if (loading) {
    const n = Math.max(1, Math.min(20, skeletonRowCount));
    return (
      <div
        className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        aria-busy="true"
        aria-label="Loading history"
      >
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
            <tr>
              <th className="px-4 py-3">Input</th>
              <th className="px-4 py-3">Analysis</th>
              <th className="px-4 py-3">Fix</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: n }, (_, i) => (
              <HistoryRowSkeleton key={`sk-${i}`} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        No logs yet. Start analyzing 🚀
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
          <tr>
            <th className="px-4 py-3">Input</th>
            <th className="px-4 py-3">Analysis</th>
            <th className="px-4 py-3">Fix</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.createdAt}-${index}`}
              className="cursor-pointer border-b border-slate-100 align-top transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
              onClick={() => onRowClick?.(row)}
            >
              <td className="max-w-xs px-4 py-3 text-slate-700 dark:text-slate-200">
                <CodeSnippet
                  text={row.input}
                  maxHeightClassName="max-h-24"
                />
              </td>
              <td className="max-w-xs px-4 py-3 text-slate-700 dark:text-slate-200">
                {row.output.analysis}
              </td>
              <td className="max-w-xs px-4 py-3 text-slate-700 dark:text-slate-200">
                {row.output.fix}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">
                {formatTimestamp(row.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

