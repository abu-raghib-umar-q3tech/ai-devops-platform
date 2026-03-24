import {
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { AppBrandLockup } from "../components/AppBrand";
import { CodeSnippet } from "../components/CodeSnippet";
import { DarkModeToggle } from "../components/DarkModeToggle";
import { HistoryTable } from "../components/HistoryTable";
import {
  analyze,
  clearToken,
  exportLogsCsv,
  exportLogsXlsx,
  getDashboardStats,
  getHistory,
  getMe,
  getAuthRole,
  type DashboardStats,
  type AnalyzeResponse,
  type HistoryItem,
  type UserProfile,
} from "../services/api";

const LazyLogsPerDayChart = lazy(() =>
  import("../components/LogsPerDayChart").then((module) => ({
    default: module.LogsPerDayChart,
  }))
);
const LazyLogDetailsModal = lazy(() =>
  import("../components/LogDetailsModal").then((module) => ({
    default: module.LogDetailsModal,
  }))
);

type DashboardPageProps = {
  isDark: boolean;
  onToggleDarkMode: () => void;
};

type SubmitEvent = Parameters<NonNullable<ComponentProps<"form">["onSubmit"]>>[0];

const HISTORY_PAGE_SIZE = 10;

function DashboardChartSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 h-6 w-40 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
      <div className="h-72 w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

/** Shown while the lazy log-details chunk loads — full modal shell, no text over real UI */
function LogDetailsModalSkeleton() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      aria-busy="true"
      aria-label="Loading log details"
    >
      <div className="w-full max-w-4xl rounded-xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="h-6 w-48 animate-pulse rounded-md bg-slate-700" />
          <div className="h-8 w-16 shrink-0 animate-pulse rounded-md bg-slate-700" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i}>
              <div className="mb-2 h-3 w-20 animate-pulse rounded bg-slate-600" />
              <div className="h-32 w-full animate-pulse rounded-lg bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardPage({
  isDark,
  onToggleDarkMode,
}: Readonly<DashboardPageProps>) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyMeta, setHistoryMeta] = useState({ total: 0, totalPages: 1 });
  const [historyNonce, setHistoryNonce] = useState(0);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedLog, setSelectedLog] = useState<HistoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const isAdmin = getAuthRole() === "admin";
  const todayCount = stats?.todaysLogsCount ?? 0;

  async function loadDashboardMeta() {
    setLoadingMeta(true);
    try {
      const [statsData, profileData] = await Promise.all([
        getDashboardStats(),
        getMe(),
      ]);
      setStats(statsData);
      setProfile(profileData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoadingMeta(false);
    }
  }

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useLayoutEffect(() => {
    setHistoryPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoadingHistory(true);
      try {
        const res = await getHistory({
          page: historyPage,
          limit: HISTORY_PAGE_SIZE,
          q: debouncedSearch || undefined,
        });
        if (cancelled) return;
        setHistory(res.data);
        setHistoryMeta({
          total: res.total,
          totalPages: res.totalPages,
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [historyPage, debouncedSearch, historyNonce]);

  useEffect(() => {
    void loadDashboardMeta();
  }, []);

  // Check role on window visibility change (user returns to tab)
  useEffect(() => {
    const checkRole = async () => {
      try {
        const currentProfile = await getMe();
        const tokenRole = getAuthRole();

        if (currentProfile.role !== tokenRole) {
          clearToken();
          toast.error(
            "Your account role has been changed. Please log in again.",
            { duration: 5000 }
          );
          navigate("/login", { replace: true });
        }
      } catch {
        // Ignore errors during check
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void checkRole();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [navigate]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!exportMenuRef.current?.contains(target)) {
        setExportMenuOpen(false);
      }
    }

    if (exportMenuOpen) {
      document.addEventListener("click", onDocumentClick);
    }

    return () => {
      document.removeEventListener("click", onDocumentClick);
    };
  }, [exportMenuOpen]);

  async function onAnalyze(event: SubmitEvent) {
    event.preventDefault();
    setError("");
    setAnalyzing(true);
    try {
      const data = await analyze(input);
      setResult(data);
      setInput("");
      setHistoryPage(1);
      setHistoryNonce((n) => n + 1);
      await loadDashboardMeta();
      toast.success("Analysis completed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      setError(message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  }

  function onLogout() {
    clearToken();
    navigate("/login", { replace: true });
  }

  async function onCopyFix() {
    if (!result?.fix) return;
    await navigator.clipboard.writeText(result.fix);
    toast.success("Copied to clipboard");
  }

  async function onExportLogsXlsx() {
    setExportingXlsx(true);
    try {
      await exportLogsXlsx();
      toast.success("Excel downloaded (wide columns)");
      setExportMenuOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      toast.error(message);
    } finally {
      setExportingXlsx(false);
    }
  }

  async function onExportLogs() {
    setExporting(true);
    try {
      await exportLogsCsv();
      toast.success("CSV downloaded");
      setExportMenuOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      toast.error(message);
    } finally {
      setExporting(false);
    }
  }

  async function onExportPdf() {
    try {
      setExportingPdf(true);
      const rows: HistoryItem[] = [];
      let page = 1;
      const limit = 100;
      const max = 500;
      const q = debouncedSearch || undefined;
      for (; ;) {
        const res = await getHistory({ page, limit, q });
        rows.push(...res.data);
        if (page >= res.totalPages || rows.length >= max) break;
        page += 1;
      }
      const capped = rows.slice(0, max);

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("AI Log Analyzer - History Report", 14, 16);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })}`, 14, 23);
      if (capped.length >= max) {
        doc.text(`(Includes up to ${max} matching entries)`, 14, 29);
      }

      autoTable(doc, {
        startY: capped.length >= max ? 34 : 28,
        head: [["Input", "Analysis", "Fix", "Created"]],
        body: capped.map((row) => [
          row.input,
          row.output.analysis,
          row.output.fix,
          new Date(row.createdAt).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true
          }),
        ]),
        styles: {
          fontSize: 7,
          cellPadding: { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 },
          overflow: "linebreak",
          valign: "top",
        },
        headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 42 },
          1: { cellWidth: 46 },
          2: { cellWidth: 46 },
          3: { cellWidth: 38 },
        },
        tableWidth: 172,
      });

      doc.save("logs-report.pdf");
      toast.success("PDF downloaded");
      setExportMenuOpen(false);
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <AppBrandLockup variant="page" />
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Admin
            </button>
          ) : null}
          <DarkModeToggle isDark={isDark} onToggle={onToggleDarkMode} />
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="mb-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total logs</p>
              {loadingMeta ? (
                <div className="mt-1 h-8 w-24 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
              ) : (
                <p className="mt-1 text-2xl font-semibold">
                  {stats?.totalLogsCount ?? 0}
                </p>
              )}
            </div>
            <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
              <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Today&apos;s logs</p>
              {loadingMeta ? (
                <div className="mt-1 h-8 w-16 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
              ) : (
                <p className="mt-1 text-2xl font-semibold">
                  {stats?.todaysLogsCount ?? 0}
                </p>
              )}
            </div>
            <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
              <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Usage count</p>
              {loadingMeta ? (
                <div className="mt-1 h-8 w-20 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
              ) : (
                <p className="mt-1 text-2xl font-semibold">
                  {profile?.usageCount ?? 0}
                </p>
              )}
            </div>
            <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-900/30">
              <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Recent logs</p>
              {loadingMeta ? (
                <div className="mt-1 h-8 w-12 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
              ) : (
                <p className="mt-1 text-2xl font-semibold">
                  {stats?.last5Logs.length ?? 0}
                </p>
              )}
            </div>
            <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900/30">
              <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-semibold">Recent logs</h2>
        <div className="space-y-2">
          {loadingMeta ? (
            <>
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="mb-2 h-3 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-600" />
                  <div className="mb-2 h-24 w-full animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-700/80" />
                  <div className="h-3 w-full animate-pulse rounded bg-slate-200/80 dark:bg-slate-700/80" />
                </div>
              ))}
            </>
          ) : (
            <>
              {(stats?.last5Logs ?? []).map((log, index) => (
                <div
                  key={`${log.createdAt}-${index}`}
                  onClick={() => setSelectedLog(log)}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm transition hover:border-indigo-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-600"
                >
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Input
                  </p>
                  <CodeSnippet
                    text={log.input}
                    maxHeightClassName="max-h-24"
                  />
                  <p className="truncate text-slate-600 dark:text-slate-300">
                    <span className="font-medium">Analysis:</span>{" "}
                    {log.output.analysis}
                  </p>
                  <p className="mt-2 text-xs text-indigo-600 dark:text-indigo-400">
                    Click to view details →
                  </p>
                </div>
              ))}
              {(stats?.last5Logs.length ?? 0) === 0 ? (
                <div className="py-12 text-center">
                  <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">No logs yet</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Start analyzing your first error below
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      {/* Chart Section - Full Width for Better Visibility */}
      <section className="mb-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Activity Overview</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Daily log analysis trends</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats?.totalLogsCount ?? 0}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Total Logs</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{todayCount}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Today</div>
              </div>
            </div>
          </div>
          {loadingMeta ? (
            <DashboardChartSkeleton />
          ) : (
            <Suspense fallback={<DashboardChartSkeleton />}>
              <LazyLogsPerDayChart series={stats?.logsPerDay ?? []} />
            </Suspense>
          )}
        </div>
      </section>

      {/* Analyze Section - Full Width */}
      <section className="mb-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Analyze logs/code</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  const text = await navigator.clipboard.readText();
                  setInput(text);
                  toast.success("Pasted from clipboard");
                }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                📋 Paste
              </button>
              {input && (
                <button
                  type="button"
                  onClick={() => setInput("")}
                  className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <form onSubmit={onAnalyze}>
            <div className="relative">
              <textarea
                value={input}
                required
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    onAnalyze(e as unknown as SubmitEvent);
                  }
                }}
                placeholder={`Paste your error message, stack trace, or code snippet here...\n\nExample:\nTypeError: Cannot read properties of undefined (reading 'length')\n    at validateInput (src/utils/validator.ts:22:14)\n    at POST /api/analyze`}
                className="h-80 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 outline-none ring-indigo-500 transition placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              {input && (
                <div className="absolute bottom-2 right-2 rounded bg-slate-200/80 px-2 py-1 text-xs text-slate-600 backdrop-blur-sm dark:bg-slate-700/80 dark:text-slate-300">
                  {input.length} characters
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Press <kbd className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">Ctrl+Enter</kbd> to analyze
              </p>
              <button
                type="submit"
                disabled={analyzing}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {analyzing ? (
                  <>
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      aria-hidden="true"
                    />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  "Analyze"
                )}
              </button>
            </div>
            {analyzing && (
              <div className="mt-3">
                <div className="h-1 w-full overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                  <div className="h-full w-3/5 animate-pulse bg-indigo-600" />
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Analyzing with AI...</p>
              </div>
            )}
          </form>
          {error ? (
            <div className="mt-4 rounded-lg border-l-4 border-red-500 bg-red-50 p-4 dark:bg-red-950/30">
              <div className="flex">
                <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Analysis Failed</h3>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
                  <button
                    onClick={() => setError("")}
                    className="mt-2 text-sm font-medium text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Dismiss →
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {result ? (
            <div className="mt-4 rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-5 shadow-lg dark:border-green-900 dark:from-green-950/30 dark:to-emerald-950/30">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-green-500 p-1">
                    <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Analysis Complete</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">(saved in History)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(result.analysis);
                      toast.success("Analysis copied!");
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    📋 Copy Analysis
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void onCopyFix();
                      toast.success("Fix copied!");
                    }}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    🔧 Copy Fix
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(`Analysis:\n${result.analysis}\n\nFix:\n${result.fix}`);
                      toast.success("All content copied!");
                    }}
                    className="rounded-md border border-indigo-300 bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700 dark:border-indigo-700 dark:bg-indigo-600"
                  >
                    📑 Copy All
                  </button>
                  <div className="h-4 w-px bg-slate-300 dark:bg-slate-600"></div>
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      toast.success("Results cleared");
                    }}
                    className="rounded-full p-1.5 text-slate-500 transition hover:bg-red-100 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                    title="Dismiss (saved in History)"
                    aria-label="Dismiss results"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-lg border border-blue-200 bg-white p-5 shadow-sm dark:border-blue-900 dark:bg-slate-900">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="rounded-full bg-blue-500 p-1.5">
                      <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                      Analysis
                    </h4>
                  </div>
                  <div className="prose max-w-none dark:prose-invert">
                    <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-800 dark:text-slate-200">
                      {result.analysis}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-green-200 bg-white p-5 shadow-sm dark:border-green-900 dark:bg-slate-900">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="rounded-full bg-green-500 p-1.5">
                      <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-green-700 dark:text-green-300">
                      Recommended Fix
                    </h4>
                  </div>
                  <div className="prose max-w-none dark:prose-invert">
                    <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-800 dark:text-slate-200">
                      {result.fix}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">History</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              You analyzed {todayCount} logs today
            </span>
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportMenuOpen((open) => !open)}
                className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
              >
                Export
              </button>
              {exportMenuOpen ? (
                <div className="absolute right-0 z-20 mt-2 min-w-[12rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <button
                    type="button"
                    disabled={exportingXlsx}
                    onClick={() => void onExportLogsXlsx()}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    {exportingXlsx ? "Exporting..." : "Export Excel (.xlsx)"}
                  </button>
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={() => void onExportLogs()}
                    className="block w-full border-t border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    {exporting ? "Exporting..." : "Export CSV"}
                  </button>
                  <button
                    type="button"
                    disabled={exportingPdf}
                    onClick={() => void onExportPdf()}
                    className="block w-full border-t border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    {exportingPdf ? "Exporting..." : "Export PDF"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {error ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        ) : null}
        <div className="mb-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search history by input, analysis, or fix..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <HistoryTable
          rows={history}
          loading={loadingHistory}
          skeletonRowCount={HISTORY_PAGE_SIZE}
          onRowClick={(row) => setSelectedLog(row)}
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Page {historyPage} of {historyMeta.totalPages}
            {historyMeta.total > 0 ? (
              <span className="ml-2 text-slate-400">
                ({historyMeta.total} total)
              </span>
            ) : null}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loadingHistory || historyPage <= 1}
              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={loadingHistory || historyPage >= historyMeta.totalPages}
              onClick={() =>
                setHistoryPage((p) =>
                  Math.min(historyMeta.totalPages, p + 1)
                )
              }
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selectedLog ? (
        <Suspense fallback={<LogDetailsModalSkeleton />}>
          <LazyLogDetailsModal
            log={selectedLog}
            onClose={() => setSelectedLog(null)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

