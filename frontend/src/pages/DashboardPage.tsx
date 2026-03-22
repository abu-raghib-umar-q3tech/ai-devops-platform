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
      for (;;) {
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
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);
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
          new Date(row.createdAt).toLocaleString(),
        ]),
        styles: {
          fontSize: 7,
          cellPadding: { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 },
          overflow: "linebreak",
          valign: "top",
        },
        headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 44 },
          1: { cellWidth: 48 },
          2: { cellWidth: 48 },
          3: { cellWidth: 34 },
        },
        tableWidth: 174,
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
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total logs</p>
          {loadingMeta ? (
            <div className="mt-1 h-8 w-24 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
          ) : (
            <p className="mt-1 text-2xl font-semibold">
              {stats?.totalLogsCount ?? 0}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Today&apos;s logs</p>
          {loadingMeta ? (
            <div className="mt-1 h-8 w-16 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
          ) : (
            <p className="mt-1 text-2xl font-semibold">
              {stats?.todaysLogsCount ?? 0}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Usage count</p>
          {loadingMeta ? (
            <div className="mt-1 h-8 w-20 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
          ) : (
            <p className="mt-1 text-2xl font-semibold">
              {profile?.usageCount ?? 0}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Recent logs</p>
          {loadingMeta ? (
            <div className="mt-1 h-8 w-12 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
          ) : (
            <p className="mt-1 text-2xl font-semibold">
              {stats?.last5Logs.length ?? 0}
            </p>
          )}
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
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800"
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
                </div>
              ))}
              {(stats?.last5Logs.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No recent logs yet.
                </p>
              ) : null}
            </>
          )}
        </div>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-lg font-semibold">Analyze logs/code</h2>
          <form onSubmit={onAnalyze}>
            <textarea
              value={input}
              required
              onChange={(event) => setInput(event.target.value)}
              placeholder={`Example:\nTypeError: Cannot read properties of undefined (reading 'length')\n    at validateInput (src/utils/validator.ts:22:14)\n    at POST /api/analyze`}
              className="h-64 w-full rounded-lg border border-slate-300 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 outline-none ring-indigo-500 transition placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 dark:border-slate-700"
            />
            <div className="mt-3 flex justify-end">
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
          </form>

          {result ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-md dark:border-slate-700 dark:bg-slate-900">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Analysis
                  </h3>
                  <CodeSnippet text={result.analysis} />
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      Fix
                    </h3>
                    <button
                      type="button"
                      onClick={() => void onCopyFix()}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-700"
                    >
                      Copy Fix
                    </button>
                  </div>
                  <CodeSnippet text={result.fix} />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-1">
          {loadingMeta ? (
            <DashboardChartSkeleton />
          ) : (
            <Suspense fallback={<DashboardChartSkeleton />}>
              <LazyLogsPerDayChart series={stats?.logsPerDay ?? []} />
            </Suspense>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">History</h2>
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            You analyzed {todayCount} logs today
          </span>
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

