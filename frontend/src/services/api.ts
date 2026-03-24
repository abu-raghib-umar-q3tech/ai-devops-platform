import toast from "react-hot-toast";

export type LoginResponse = {
  token: string;
};

export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  usageCount: number;
};

export type AnalyzeResponse = {
  analysis: string;
  fix: string;
};

export type HistoryItem = {
  input: string;
  output: {
    analysis: string;
    fix: string;
  };
  createdAt: string;
};

export type LogsPerDayPoint = {
  date: string;
  count: number;
};

export type DashboardStats = {
  totalLogsCount: number;
  todaysLogsCount: number;
  last5Logs: HistoryItem[];
  logsPerDay: LogsPerDayPoint[];
};

export type AdminUser = {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  usageCount: number;
};

export type AdminLog = {
  _id: string;
  userId: string;
  input: string;
  output: {
    analysis: string;
    fix: string;
  };
  createdAt: string;
};

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
};

export type AdminUsersPage = Paginated<AdminUser>;

export type AdminLogsPage = Paginated<AdminLog>;

export type AdminStats = {
  totalUsers: number;
  totalLogs: number;
  usageCountSum: number;
};

const TOKEN_KEY = "token";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";
let hasShownSessionExpiredToast = false;

function buildHeaders(withAuth = false): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (withAuth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function handleUnauthorized(): void {
  clearToken();
  if (!hasShownSessionExpiredToast) {
    toast.error("Session expired");
    hasShownSessionExpiredToast = true;
  }
  if (globalThis.location.pathname !== "/login") {
    globalThis.location.assign("/login");
  }
}

function handleForbidden(): void {
  clearToken();
  toast.error("Access denied. Your permissions may have changed.");
  if (globalThis.location.pathname.startsWith("/admin")) {
    globalThis.location.assign("/");
  }
}

async function parseJson<T>(
  response: Response,
  options?: { handleAuthError?: boolean }
): Promise<T> {
  const data = (await response.json()) as T & { message?: string };
  const shouldHandleAuthError = options?.handleAuthError ?? false;

  if (shouldHandleAuthError) {
    if (response.status === 401) {
      handleUnauthorized();
    }
    if (response.status === 403) {
      handleForbidden();
    }
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const normalized = parts[1].replaceAll("-", "+").replaceAll("_", "/");
    const json = atob(normalized);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getAuthRole(): string | null {
  const token = getToken();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  return typeof payload?.role === "string" ? payload.role : null;
}

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson<LoginResponse>(response);
  setToken(data.token);
  hasShownSessionExpiredToast = false;
}

export async function signup(
  firstName: string,
  lastName: string,
  email: string,
  password: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ firstName, lastName, email, password }),
  });
  await parseJson<{ message: string }>(response);
}

export async function analyze(input: string): Promise<AnalyzeResponse> {
  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ input }),
  });
  return parseJson<AnalyzeResponse>(response, { handleAuthError: true });
}

export type HistoryPage = Paginated<HistoryItem>;

export async function getHistory(params?: {
  page?: number;
  limit?: number;
  /** Search input, analysis, and fix (case-insensitive) */
  q?: string;
}): Promise<HistoryPage> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.q?.trim()) search.set("q", params.q.trim());
  const query = search.toString();
  const response = await fetch(
    `${API_BASE_URL}/logs/history${query ? `?${query}` : ""}`,
    {
      method: "GET",
      headers: buildHeaders(true),
    }
  );
  return parseJson<HistoryPage>(response, { handleAuthError: true });
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return parseJson<DashboardStats>(response, { handleAuthError: true });
}

export async function getMe(): Promise<UserProfile> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  const data = await parseJson<{ user: UserProfile }>(response, {
    handleAuthError: true,
  });
  return data.user;
}

export async function exportLogsCsv(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/logs/export`, {
    method: "GET",
    headers: buildHeaders(true),
  });

  if (response.status === 401) {
    handleUnauthorized();
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(data.message || "Failed to export logs");
  }

  const blob = await response.blob();
  const url = globalThis.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "logs.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  globalThis.URL.revokeObjectURL(url);
}

export async function getAdminStats(): Promise<AdminStats> {
  const response = await fetch(`${API_BASE_URL}/admin/stats`, {
    method: "GET",
    headers: buildHeaders(true),
  });
  return parseJson<AdminStats>(response, { handleAuthError: true });
}

export async function getAdminUsers(params?: {
  page?: number;
  limit?: number;
}): Promise<AdminUsersPage> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.limit != null) search.set("limit", String(params.limit));
  const query = search.toString();
  const response = await fetch(
    `${API_BASE_URL}/admin/users${query ? `?${query}` : ""}`,
    {
      method: "GET",
      headers: buildHeaders(true),
    }
  );
  return parseJson<AdminUsersPage>(response, { handleAuthError: true });
}

export async function getAdminLogs(params?: {
  page?: number;
  limit?: number;
  userId?: string;
  from?: string;
  to?: string;
}): Promise<AdminLogsPage> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.userId) search.set("userId", params.userId);
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const query = search.toString();
  const response = await fetch(
    `${API_BASE_URL}/admin/logs${query ? `?${query}` : ""}`,
    {
      method: "GET",
      headers: buildHeaders(true),
    }
  );
  return parseJson<AdminLogsPage>(response, { handleAuthError: true });
}

async function downloadAdminBlob(
  path: string,
  filename: string,
  errorMessage: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: buildHeaders(true),
  });

  if (response.status === 401) {
    handleUnauthorized();
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(data.message || errorMessage);
  }

  const blob = await response.blob();
  const url = globalThis.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  globalThis.URL.revokeObjectURL(url);
}

export async function exportLogsXlsx(): Promise<void> {
  await downloadAdminBlob(
    "/logs/export/xlsx",
    "logs.xlsx",
    "Failed to export logs"
  );
}

export async function exportAdminUsersCsv(): Promise<void> {
  await downloadAdminBlob(
    "/admin/users/export",
    "users.csv",
    "Failed to export users"
  );
}

export async function exportAdminLogsCsv(): Promise<void> {
  await downloadAdminBlob(
    "/admin/logs/export",
    "admin-logs.csv",
    "Failed to export logs"
  );
}

export async function exportAdminUsersPdf(): Promise<void> {
  await downloadAdminBlob(
    "/admin/users/export/pdf",
    "admin-users.pdf",
    "Failed to export users PDF"
  );
}

export async function exportAdminLogsPdf(): Promise<void> {
  await downloadAdminBlob(
    "/admin/logs/export/pdf",
    "admin-logs.pdf",
    "Failed to export logs PDF"
  );
}

export async function exportAdminUsersXlsx(): Promise<void> {
  await downloadAdminBlob(
    "/admin/users/export/xlsx",
    "users.xlsx",
    "Failed to export users spreadsheet"
  );
}

export async function exportAdminLogsXlsx(): Promise<void> {
  await downloadAdminBlob(
    "/admin/logs/export/xlsx",
    "admin-logs.xlsx",
    "Failed to export logs spreadsheet"
  );
}

export async function updateAdminUserRole(
  userId: string,
  role: "admin" | "user"
): Promise<AdminUser> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: buildHeaders(true),
    body: JSON.stringify({ role }),
  });
  const data = await parseJson<{ user: AdminUser }>(response, {
    handleAuthError: true,
  });
  return data.user;
}

export async function deleteAdminLog(logId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/logs/${logId}`, {
    method: "DELETE",
    headers: buildHeaders(true),
  });
  await parseJson<{ message: string }>(response, { handleAuthError: true });
}

export async function deleteAdminUser(userId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
    method: "DELETE",
    headers: buildHeaders(true),
  });
  await parseJson<{ message: string }>(response, { handleAuthError: true });
}

