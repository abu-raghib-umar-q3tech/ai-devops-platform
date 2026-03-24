import type { Response } from "express";
import { LogModel } from "../models/Log";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { sendUserLogsXlsx } from "../utils/excelExport";

const HISTORY_DEFAULT_PAGE = 1;
const HISTORY_DEFAULT_LIMIT = 10;
const HISTORY_MAX_LIMIT = 100;

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeCsvCell(value: string): string {
  const escaped = value.split('"').join('""');
  return `"${escaped}"`;
}

export async function getLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const page = parsePositiveInt(req.query.page, HISTORY_DEFAULT_PAGE);
    let limit = parsePositiveInt(req.query.limit, HISTORY_DEFAULT_LIMIT);
    if (limit > HISTORY_MAX_LIMIT) limit = HISTORY_MAX_LIMIT;
    const skip = (page - 1) * limit;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const filter: Record<string, unknown> = { userId };
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [
        { input: rx },
        { "output.analysis": rx },
        { "output.fix": rx },
      ];
    }

    const [total, logs] = await Promise.all([
      LogModel.countDocuments(filter),
      LogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select({ _id: 0, input: 1, output: 1, createdAt: 1 })
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.status(200).json({
      data: logs,
      total,
      page,
      totalPages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

export async function exportLogsCsv(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const logs = await LogModel.find({ userId })
      .sort({ createdAt: -1 })
      .select({ _id: 0, input: 1, output: 1, createdAt: 1 })
      .lean();

    const header = ["input", "analysis", "fix", "createdAt"];
    const rows = logs.map((log) => {
      const date = new Date(log.createdAt);
      // Format as: 25-Mar-2026 02:17AM (compact for CSV)
      const day = date.toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit" });
      const month = date.toLocaleString("en-GB", { timeZone: "Asia/Kolkata", month: "short" });
      const year = date.toLocaleString("en-GB", { timeZone: "Asia/Kolkata", year: "numeric" });
      const time = date.toLocaleString("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      }).replace(" ", ""); // Remove space between time and AM/PM
      const formatted = `${day}-${month}-${year} ${time}`;

      return [
        escapeCsvCell(log.input),
        escapeCsvCell(log.output?.analysis ?? ""),
        escapeCsvCell(log.output?.fix ?? ""),
        escapeCsvCell(formatted),
      ];
    });

    const body = [header.join(","), ...rows.map((row) => row.join(","))].join(
      "\r\n"
    );
    const csv = `\uFEFF${body}`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="logs.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

export async function exportLogsXlsx(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const logs = await LogModel.find({ userId })
      .sort({ createdAt: -1 })
      .select({ input: 1, output: 1, createdAt: 1 })
      .lean();

    await sendUserLogsXlsx(res, "logs.xlsx", logs);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

