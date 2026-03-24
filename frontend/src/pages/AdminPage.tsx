import { useCallback, useEffect, useRef, useState } from "react";
import { AppBrandAdminHeading } from "../components/AppBrand";
import { CodeSnippet } from "../components/CodeSnippet";
import { ConfirmModal } from "../components/ConfirmModal";
import { DarkModeToggle } from "../components/DarkModeToggle";
import { LogPreviewCell } from "../components/LogPreviewCell";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  clearToken,
  deleteAdminLog,
  deleteAdminUser,
  exportAdminLogsCsv,
  exportAdminLogsPdf,
  exportAdminLogsXlsx,
  exportAdminUsersCsv,
  exportAdminUsersPdf,
  exportAdminUsersXlsx,
  getAdminLogs,
  getAdminStats,
  getAdminUsers,
  updateAdminUserRole,
  type AdminLog,
  type AdminUser,
} from "../services/api";

function formatDate(value: string): string {
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

function roleBadgeClass(role: string): string {
  return role === "admin"
    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
}

/** Page buttons with ellipses for large page counts */
function buildPageList(
  current: number,
  total: number
): (number | "dots")[] {
  if (total <= 0) return [1];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>();
  set.add(1);
  set.add(total);
  for (let p = current - 2; p <= current + 2; p++) {
    if (p >= 1 && p <= total) set.add(p);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "dots")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (i > 0 && n - sorted[i - 1]! > 1) {
      out.push("dots");
    }
    out.push(n);
  }
  return out;
}

const paginationBtn =
  "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800";
const paginationBtnActive =
  "rounded-md border border-indigo-500 bg-indigo-50 px-2.5 py-1.5 text-sm font-semibold text-indigo-800 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-200";

const ALLOWED_LIMITS = [10, 20, 50] as const;

function parsePageParam(value: string | null, fallback = 1): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

function parseLimitParam(value: string | null): number {
  const n = Number.parseInt(value ?? "", 10);
  return ALLOWED_LIMITS.includes(n as (typeof ALLOWED_LIMITS)[number])
    ? n
    : 10;
}

/** Strip default query keys for cleaner shareable URLs */
function pruneDefaultAdminParams(p: URLSearchParams): void {
  if (p.get("page") === "1") p.delete("page");
  if (p.get("usersPage") === "1") p.delete("usersPage");
  if (!p.get("limit") || p.get("limit") === "10") p.delete("limit");
  if (!p.get("userId")?.trim()) p.delete("userId");
  if (!p.get("from")) p.delete("from");
  if (!p.get("to")) p.delete("to");
}

function readAdminQueryFromLocation(): {
  logsPage: number;
  usersPage: number;
  pageLimit: number;
  userId?: string;
  from?: string;
  to?: string;
} {
  const q = new URLSearchParams(globalThis.location.search);
  return {
    logsPage: parsePageParam(q.get("page")),
    usersPage: parsePageParam(q.get("usersPage")),
    pageLimit: parseLimitParam(q.get("limit")),
    userId: q.get("userId")?.trim() || undefined,
    from: q.get("from") || undefined,
    to: q.get("to") || undefined,
  };
}

function ShimmerBlock({ className }: Readonly<{ className?: string }>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200/90 dark:bg-slate-700/80 ${className ?? ""}`}
    />
  );
}

function UsersTableSkeleton({ rows }: Readonly<{ rows: number }>) {
  return (
    <tbody aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <tr
          key={i}
          className="border-b border-slate-100 dark:border-slate-800"
        >
          <td className="px-4 py-3 align-top w-[30%]">
            <ShimmerBlock className="h-4 w-full" />
          </td>
          <td className="px-4 py-3 align-top w-[15%]">
            <ShimmerBlock className="h-4 w-32" />
          </td>
          <td className="px-4 py-3 align-top w-[15%]">
            <ShimmerBlock className="h-4 w-28" />
          </td>
          <td className="px-4 py-3 align-top w-[10%]">
            <ShimmerBlock className="h-6 w-14 rounded-full" />
          </td>
          <td className="px-4 py-3 align-top w-[10%]">
            <ShimmerBlock className="h-4 w-8" />
          </td>
          <td className="px-4 py-3 align-top w-[20%]">
            <div className="flex gap-2">
              <ShimmerBlock className="h-7 w-16" />
              <ShimmerBlock className="h-7 w-16" />
              <ShimmerBlock className="h-7 w-14" />
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}

function LogsTableSkeleton({ rows }: Readonly<{ rows: number }>) {
  return (
    <tbody aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <tr
          key={i}
          className="border-b border-slate-100 dark:border-slate-800"
        >
          <td className="px-4 py-3 align-top">
            <ShimmerBlock className="h-4 w-24" />
          </td>
          <td className="max-w-xs px-4 py-3 align-top">
            <ShimmerBlock className="h-16 w-full min-h-[4rem]" />
          </td>
          <td className="max-w-xs px-4 py-3 align-top">
            <ShimmerBlock className="h-4 w-full" />
            <ShimmerBlock className="mt-2 h-3 w-4/5 max-w-[12rem]" />
          </td>
          <td className="max-w-xs px-4 py-3 align-top">
            <ShimmerBlock className="h-4 w-full" />
            <ShimmerBlock className="mt-2 h-3 w-3/5 max-w-[10rem]" />
          </td>
          <td className="px-4 py-3 align-top">
            <ShimmerBlock className="h-4 w-36" />
          </td>
          <td className="px-4 py-3 align-top">
            <div className="flex gap-2">
              <ShimmerBlock className="h-7 w-16" />
              <ShimmerBlock className="h-7 w-16" />
              <ShimmerBlock className="h-7 w-14" />
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}

function PaginationBar(props: Readonly<{
  page: number;
  totalPages: number;
  disabled?: boolean;
  onPageChange: (p: number) => void;
}>) {
  const { page, totalPages, disabled, onPageChange } = props;
  const pages = buildPageList(page, totalPages);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Page {page} of {totalPages}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={paginationBtn}
        >
          Prev
        </button>
        {pages.map((item, index) =>
          item === "dots" ? (
            <span
              key={`dots-${pages
                .slice(0, index)
                .filter((p) => p === "dots").length}`}
              className="px-1 text-sm text-slate-400"
              aria-hidden
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              disabled={disabled}
              aria-current={item === page ? "page" : undefined}
              onClick={() => onPageChange(item)}
              className={item === page ? paginationBtnActive : paginationBtn}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={paginationBtn}
        >
          Next
        </button>
      </div>
    </div>
  );
}

type AdminPageProps = {
  isDark: boolean;
  onToggleDarkMode: () => void;
};

export function AdminPage({
  isDark,
  onToggleDarkMode,
}: Readonly<AdminPageProps>) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const pageLimit = parseLimitParam(searchParams.get("limit"));
  const logsPage = parsePageParam(searchParams.get("page"));
  const usersPage = parsePageParam(searchParams.get("usersPage"));
  const filterFromDate = searchParams.get("from") ?? "";
  const filterToDate = searchParams.get("to") ?? "";

  const mergeParams = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        mutate(next);
        pruneDefaultAdminParams(next);
        return next;
      }, { replace: true });
    },
    [setSearchParams]
  );

  const setLogsPage = useCallback(
    (p: number) => {
      const v = Math.max(1, p);
      mergeParams((n) => {
        if (v <= 1) n.delete("page");
        else n.set("page", String(v));
      });
    },
    [mergeParams]
  );

  const setUsersPage = useCallback(
    (p: number) => {
      const v = Math.max(1, p);
      mergeParams((n) => {
        if (v <= 1) n.delete("usersPage");
        else n.set("usersPage", String(v));
      });
    },
    [mergeParams]
  );

  const setPageLimit = useCallback(
    (lim: number) => {
      mergeParams((n) => {
        n.set("limit", String(lim));
        n.delete("page");
        n.delete("usersPage");
      });
    },
    [mergeParams]
  );

  const setFromDateParam = useCallback(
    (v: string) => {
      mergeParams((n) => {
        if (v) n.set("from", v);
        else n.delete("from");
        n.delete("page");
      });
    },
    [mergeParams]
  );

  const setToDateParam = useCallback(
    (v: string) => {
      mergeParams((n) => {
        if (v) n.set("to", v);
        else n.delete("to");
        n.delete("page");
      });
    },
    [mergeParams]
  );

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalLogs: 0,
    usageCountSum: 0,
  });
  const [usersMeta, setUsersMeta] = useState({ total: 0, totalPages: 1 });
  const [logsMeta, setLogsMeta] = useState({ total: 0, totalPages: 1 });
  const [selectedLog, setSelectedLog] = useState<AdminLog | null>(null);
  const [filterUserId, setFilterUserId] = useState(
    () => searchParams.get("userId") ?? ""
  );
  const skipNextUserIdUrlSync = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usersExportMenuOpen, setUsersExportMenuOpen] = useState(false);
  const [logsExportMenuOpen, setLogsExportMenuOpen] = useState(false);
  const [exportingUsersXlsx, setExportingUsersXlsx] = useState(false);
  const [exportingUsersCsv, setExportingUsersCsv] = useState(false);
  const [exportingUsersPdf, setExportingUsersPdf] = useState(false);
  const [exportingLogsXlsx, setExportingLogsXlsx] = useState(false);
  const [exportingLogsCsv, setExportingLogsCsv] = useState(false);
  const [exportingLogsPdf, setExportingLogsPdf] = useState(false);
  const usersExportMenuRef = useRef<HTMLDivElement>(null);
  const logsExportMenuRef = useRef<HTMLDivElement>(null);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
    variant?: "default" | "destructive";
    emphasizeIrreversible?: boolean;
    allowOutsideClick?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => undefined,
    variant: "default",
    emphasizeIrreversible: false,
    allowOutsideClick: true,
  });

  const totalUsers = stats.totalUsers;
  const totalLogs = stats.totalLogs;
  const totalUsageCount = stats.usageCountSum;

  const userIdInUrl = searchParams.get("userId") ?? "";
  useEffect(() => {
    if (skipNextUserIdUrlSync.current) {
      skipNextUserIdUrlSync.current = false;
      return;
    }
    setFilterUserId(userIdInUrl);
  }, [userIdInUrl]);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      setSearchParams((prev) => {
        const trimmed = filterUserId.trim();
        const current = prev.get("userId") ?? "";
        if (trimmed === current.trim()) return prev;
        skipNextUserIdUrlSync.current = true;
        const next = new URLSearchParams(prev);
        if (trimmed) next.set("userId", trimmed);
        else next.delete("userId");
        next.delete("page");
        pruneDefaultAdminParams(next);
        return next;
      }, { replace: true });
    }, 300);
    return () => clearTimeout(timeout);
  }, [filterUserId, setSearchParams]);

  // Check admin access on window visibility change (user returns to tab)
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api"}/auth/me`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (response.ok) {
          const data = (await response.json()) as { user: { role: string } };
          if (data.user.role !== "admin") {
            clearToken();
            toast.error(
              "Your admin access has been revoked. Redirecting...",
              { duration: 5000 }
            );
            navigate("/", { replace: true });
          }
        }
      } catch {
        // Ignore errors during check
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void checkAdminAccess();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [navigate]);

  const queryKey = searchParams.toString();
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const q = new URLSearchParams(queryKey);
      const lp = parsePageParam(q.get("page"));
      const up = parsePageParam(q.get("usersPage"));
      const lim = parseLimitParam(q.get("limit"));
      const uid = q.get("userId")?.trim() || undefined;
      const from = q.get("from") || undefined;
      const to = q.get("to") || undefined;
      try {
        const logQuery = {
          page: lp,
          limit: lim,
          userId: uid,
          from,
          to,
        };
        const [statsRes, usersRes, logsRes] = await Promise.all([
          getAdminStats(),
          getAdminUsers({ page: up, limit: lim }),
          getAdminLogs(logQuery),
        ]);
        if (cancelled) return;
        setStats(statsRes);
        setUsers(usersRes.data);
        setUsersMeta({
          total: usersRes.total,
          totalPages: usersRes.totalPages,
        });
        setLogs(logsRes.data);
        setLogsMeta({
          total: logsRes.total,
          totalPages: logsRes.totalPages,
        });
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load admin data";
        setError(message);
        toast.error(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [queryKey]);

  useEffect(() => {
    if (!usersExportMenuOpen && !logsExportMenuOpen) return;

    function onDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        usersExportMenuOpen &&
        !usersExportMenuRef.current?.contains(target)
      ) {
        setUsersExportMenuOpen(false);
      }
      if (
        logsExportMenuOpen &&
        !logsExportMenuRef.current?.contains(target)
      ) {
        setLogsExportMenuOpen(false);
      }
    }

    document.addEventListener("click", onDocumentClick);
    return () => {
      document.removeEventListener("click", onDocumentClick);
    };
  }, [usersExportMenuOpen, logsExportMenuOpen]);

  function onLogout() {
    clearToken();
    navigate("/login", { replace: true });
  }

  async function onCopyLog(log: AdminLog) {
    const content = `Input:\n${log.input}\n\nAnalysis:\n${log.output?.analysis ?? ""}\n\nFix:\n${log.output?.fix ?? ""}`;
    await navigator.clipboard.writeText(content);
    toast.success("Log copied to clipboard");
  }

  async function onChangeUserRole(user: AdminUser, role: "admin" | "user") {
    if (user.role === role) return;
    setConfirmState({
      isOpen: true,
      title: "Confirm role change",
      message: `Change role for ${user.email} to ${role}?`,
      variant: "default",
      allowOutsideClick: true,
      onConfirm: async () => {
        try {
          const updated = await updateAdminUserRole(user._id, role);
          setUsers((prev) =>
            prev.map((u) =>
              u._id === updated._id ? { ...u, role: updated.role } : u
            )
          );
          toast.success("User role updated");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to update role");
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  }

  const logsQueryParams = () => {
    const q = readAdminQueryFromLocation();
    return {
      userId: q.userId,
      from: q.from,
      to: q.to,
    };
  };

  async function onDeleteLog(log: AdminLog) {
    setConfirmState({
      isOpen: true,
      title: "Confirm log deletion",
      message: "Delete this log? This action cannot be undone.",
      variant: "destructive",
      emphasizeIrreversible: true,
      allowOutsideClick: false,
      onConfirm: async () => {
        setSelectedLog((prev) => (prev?._id === log._id ? null : prev));
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          await deleteAdminLog(log._id);
          let { logsPage: page, pageLimit: lim } = readAdminQueryFromLocation();
          let res = await getAdminLogs({
            page,
            limit: lim,
            ...logsQueryParams(),
          });
          if (page > res.totalPages) {
            page = Math.max(1, res.totalPages);
            res = await getAdminLogs({
              page,
              limit: lim,
              ...logsQueryParams(),
            });
          }
          setLogsPage(page);
          setLogs(res.data);
          setLogsMeta({ total: res.total, totalPages: res.totalPages });
          setStats(await getAdminStats());
          toast.success("Log deleted successfully ✅");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to delete log");
        }
      },
    });
  }

  function onDeleteUser(user: AdminUser) {
    setConfirmState({
      isOpen: true,
      title: "Confirm user deletion",
      message: `Delete ${user.email}? This also removes their logs.`,
      variant: "destructive",
      emphasizeIrreversible: true,
      allowOutsideClick: false,
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          await deleteAdminUser(user._id);

          let { usersPage: up, logsPage: lp, pageLimit: lim } =
            readAdminQueryFromLocation();
          let ur = await getAdminUsers({ page: up, limit: lim });
          if (up > ur.totalPages) {
            up = Math.max(1, ur.totalPages);
            ur = await getAdminUsers({ page: up, limit: lim });
          }
          setUsersPage(up);
          setUsers(ur.data);
          setUsersMeta({
            total: ur.total,
            totalPages: ur.totalPages,
          });

          let lr = await getAdminLogs({
            page: lp,
            limit: lim,
            ...logsQueryParams(),
          });
          if (lp > lr.totalPages) {
            lp = Math.max(1, lr.totalPages);
            lr = await getAdminLogs({
              page: lp,
              limit: lim,
              ...logsQueryParams(),
            });
          }
          setLogsPage(lp);
          setLogs(lr.data);
          setLogsMeta({ total: lr.total, totalPages: lr.totalPages });
          setStats(await getAdminStats());

          toast.success("User deleted successfully");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to delete user");
        }
      },
    });
  }

  async function onExportUsersXlsx() {
    try {
      setExportingUsersXlsx(true);
      await exportAdminUsersXlsx();
      toast.success("Excel file downloaded (wide columns)");
      setUsersExportMenuOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingUsersXlsx(false);
    }
  }

  async function onExportUsersCsv() {
    try {
      setExportingUsersCsv(true);
      await exportAdminUsersCsv();
      toast.success("CSV downloaded");
      setUsersExportMenuOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingUsersCsv(false);
    }
  }

  async function onExportAdminLogsXlsx() {
    try {
      setExportingLogsXlsx(true);
      await exportAdminLogsXlsx();
      toast.success("Excel file downloaded (wide columns)");
      setLogsExportMenuOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingLogsXlsx(false);
    }
  }

  async function onExportAdminLogsCsv() {
    try {
      setExportingLogsCsv(true);
      await exportAdminLogsCsv();
      toast.success("CSV downloaded");
      setLogsExportMenuOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingLogsCsv(false);
    }
  }

  async function onExportUsersPdf() {
    try {
      setExportingUsersPdf(true);
      await exportAdminUsersPdf();
      toast.success("Users PDF downloaded");
      setUsersExportMenuOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingUsersPdf(false);
    }
  }

  async function onExportAdminLogsPdf() {
    try {
      setExportingLogsPdf(true);
      await exportAdminLogsPdf();
      toast.success("Logs PDF downloaded");
      setLogsExportMenuOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingLogsPdf(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <AppBrandAdminHeading />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/", { replace: true })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Back to App
          </button>
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

      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <section className="mb-8 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total users</p>
          <p
            className={`mt-1 text-2xl font-semibold ${loading ? "animate-pulse text-slate-300 dark:text-slate-600" : ""}`}
          >
            {totalUsers}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total logs</p>
          <p
            className={`mt-1 text-2xl font-semibold ${loading ? "animate-pulse text-slate-300 dark:text-slate-600" : ""}`}
          >
            {totalLogs}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Total usage count
          </p>
          <p
            className={`mt-1 text-2xl font-semibold ${loading ? "animate-pulse text-slate-300 dark:text-slate-600" : ""}`}
          >
            {totalUsageCount}
          </p>
        </div>
      </section>

      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          Show:
          <select
            value={pageLimit}
            disabled={loading}
            onChange={(event) => {
              const v = Number.parseInt(event.target.value, 10);
              if (v === 10 || v === 20 || v === 50) setPageLimit(v);
            }}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-800 outline-none ring-indigo-500 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            {ALLOWED_LIMITS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-slate-500 dark:text-slate-500">per page</span>
        </label>
      </div>

      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Users</h2>
          <div className="relative" ref={usersExportMenuRef}>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setLogsExportMenuOpen(false);
                setUsersExportMenuOpen((open) => !open);
              }}
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
            >
              Export
            </button>
            {usersExportMenuOpen ? (
              <div className="absolute right-0 z-20 mt-2 min-w-[12rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                <button
                  type="button"
                  disabled={loading || exportingUsersXlsx}
                  onClick={() => void onExportUsersXlsx()}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  {exportingUsersXlsx
                    ? "Exporting..."
                    : "Export Excel (.xlsx)"}
                </button>
                <button
                  type="button"
                  disabled={loading || exportingUsersCsv}
                  onClick={() => void onExportUsersCsv()}
                  className="block w-full border-t border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  {exportingUsersCsv ? "Exporting..." : "Export CSV"}
                </button>
                <button
                  type="button"
                  disabled={loading || exportingUsersPdf}
                  onClick={() => void onExportUsersPdf()}
                  className="block w-full border-t border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  {exportingUsersPdf ? "Exporting..." : "Export PDF"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
              <tr>
                <th className="px-4 py-3 w-[30%]">Email</th>
                <th className="px-4 py-3 w-[15%]">First name</th>
                <th className="px-4 py-3 w-[15%]">Last name</th>
                <th className="px-4 py-3 w-[10%]">Role</th>
                <th className="px-4 py-3 w-[10%]">
                  Usage Count
                </th>
                <th className="px-4 py-3 w-[20%]">Actions</th>
              </tr>
            </thead>
            {loading ? (
              <UsersTableSkeleton rows={Math.min(pageLimit, 8)} />
            ) : (
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      No results found for this page
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user._id}
                      className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
                    >
                      <td className="px-4 py-3 align-top w-[30%]">
                        <span className="block truncate" title={user.email}>
                          {user.email}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-800 dark:text-slate-100 w-[15%]">
                        {user.firstName?.trim() ? user.firstName : "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-slate-800 dark:text-slate-100 w-[15%]">
                        {user.lastName?.trim() ? user.lastName : "—"}
                      </td>
                      <td className="px-4 py-3 align-top w-[10%]">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClass(user.role)}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top font-semibold whitespace-nowrap w-[10%]">
                        {user.usageCount ?? 0}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap w-[20%]">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void onChangeUserRole(user, "admin")}
                            className="rounded-md border border-violet-300 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-300 dark:hover:bg-violet-900/30"
                          >
                            Make admin
                          </button>
                          <button
                            type="button"
                            onClick={() => void onChangeUserRole(user, "user")}
                            className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                          >
                            Make user
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteUser(user)}
                            className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-300 dark:hover:bg-rose-900/30"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            )}
          </table>
        </div>
        <PaginationBar
          page={usersPage}
          totalPages={usersMeta.totalPages}
          disabled={loading}
          onPageChange={setUsersPage}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Logs</h2>
          <div className="relative" ref={logsExportMenuRef}>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setUsersExportMenuOpen(false);
                setLogsExportMenuOpen((open) => !open);
              }}
              className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
            >
              Export
            </button>
            {logsExportMenuOpen ? (
              <div className="absolute right-0 z-20 mt-2 min-w-[12rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                <button
                  type="button"
                  disabled={loading || exportingLogsXlsx}
                  onClick={() => void onExportAdminLogsXlsx()}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  {exportingLogsXlsx
                    ? "Exporting..."
                    : "Export Excel (.xlsx)"}
                </button>
                <button
                  type="button"
                  disabled={loading || exportingLogsCsv}
                  onClick={() => void onExportAdminLogsCsv()}
                  className="block w-full border-t border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  {exportingLogsCsv ? "Exporting..." : "Export CSV"}
                </button>
                <button
                  type="button"
                  disabled={loading || exportingLogsPdf}
                  onClick={() => void onExportAdminLogsPdf()}
                  className="block w-full border-t border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  {exportingLogsPdf ? "Exporting..." : "Export PDF"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mb-3 grid gap-2 md:grid-cols-3">
          <input
            type="text"
            value={filterUserId}
            onChange={(event) => setFilterUserId(event.target.value)}
            placeholder="Filter by userId"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-900"
          />
          <input
            type="date"
            value={filterFromDate}
            onChange={(event) => setFromDateParam(event.target.value)}
            aria-label="Filter logs from date"
            title="Filter logs from date"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-900"
          />
          <input
            type="date"
            value={filterToDate}
            onChange={(event) => setToDateParam(event.target.value)}
            aria-label="Filter logs to date"
            title="Filter logs to date"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 transition focus:ring-2 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
              <tr>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Input</th>
                <th className="px-4 py-3">Analysis</th>
                <th className="px-4 py-3">Fix</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            {loading ? (
              <LogsTableSkeleton rows={Math.min(pageLimit, 8)} />
            ) : (
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      No results found for this page
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log._id}
                      className="border-b border-slate-100 align-top transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
                    >
                      <td className="max-w-[12rem] px-4 py-3 align-top">
                        <span className="block break-all font-mono text-xs text-slate-700 dark:text-slate-200">
                          {log.userId}
                        </span>
                      </td>
                      <td className="max-w-xs min-w-0 px-4 py-3 align-top text-slate-700 dark:text-slate-200">
                        <CodeSnippet
                          text={log.input}
                          maxHeightClassName="max-h-24"
                        />
                      </td>
                      <td className="max-w-xs min-w-0 px-4 py-3 align-top text-slate-700 dark:text-slate-200">
                        <LogPreviewCell text={log.output?.analysis ?? ""} />
                      </td>
                      <td className="max-w-xs min-w-0 px-4 py-3 align-top text-slate-700 dark:text-slate-200">
                        <LogPreviewCell text={log.output?.fix ?? ""} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-slate-500 dark:text-slate-400">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void onCopyLog(log)}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                          >
                            Copy log
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
                          >
                            View full
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteLog(log)}
                            className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-300 dark:hover:bg-rose-900/30"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            )}
          </table>
        </div>
        <PaginationBar
          page={logsPage}
          totalPages={logsMeta.totalPages}
          disabled={loading}
          onPageChange={setLogsPage}
        />
      </section>

      {selectedLog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-100">
                Full log details
              </h3>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 font-mono text-sm text-slate-100">
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                  Input
                </p>
                <pre className="whitespace-pre-wrap">{selectedLog.input}</pre>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                  Analysis
                </p>
                <pre className="whitespace-pre-wrap">
                  {selectedLog.output?.analysis}
                </pre>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                  Fix
                </p>
                <pre className="whitespace-pre-wrap">{selectedLog.output?.fix}</pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        emphasizeIrreversible={confirmState.emphasizeIrreversible}
        allowOutsideClick={confirmState.allowOutsideClick}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => void confirmState.onConfirm()}
      />
    </div>
  );
}

