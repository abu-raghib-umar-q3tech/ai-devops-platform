import type { Request, Response } from "express";
import { LogModel } from "../models/Log";
import { UserModel } from "../models/User";
import {
  streamAdminLogsPdf,
  streamAdminUsersPdf,
} from "../utils/adminPdfExport";
import { sendAdminLogsXlsx, sendUsersXlsx } from "../utils/excelExport";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

function getPagination(req: Request): { page: number; limit: number; skip: number } {
  const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
  let limit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT);
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** RFC 4180–friendly: always quote so Excel keeps columns aligned with commas/newlines inside cells */
function csvQuotedCell(value: string | number): string {
  const s = String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function withUtf8Bom(csv: string): string {
  return `\uFEFF${csv}`;
}

export async function exportAdminUsers(req: Request, res: Response) {
  try {
    const users = await UserModel.find({})
      .select({ email: 1, firstName: 1, lastName: 1, role: 1, usageCount: 1 })
      .sort({ email: 1 })
      .lean();

    const header = [
      "email",
      "firstName",
      "lastName",
      "role",
      "usageCount",
    ]
      .map(csvQuotedCell)
      .join(",");
    const rows = users.map((u) =>
      [
        csvQuotedCell(u.email),
        csvQuotedCell(u.firstName ?? ""),
        csvQuotedCell(u.lastName ?? ""),
        csvQuotedCell(u.role),
        csvQuotedCell(u.usageCount ?? 0),
      ].join(",")
    );
    const csv = withUtf8Bom([header, ...rows].join("\r\n"));

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="users.csv"'
    );
    return res.status(200).send(csv);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

export async function exportAdminUsersPdf(_req: Request, res: Response) {
  try {
    const users = await UserModel.find({})
      .select({ email: 1, firstName: 1, lastName: 1, role: 1, usageCount: 1 })
      .sort({ email: 1 })
      .lean();
    streamAdminUsersPdf(res, users);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

export async function exportAdminUsersXlsx(_req: Request, res: Response) {
  try {
    const users = await UserModel.find({})
      .select({ email: 1, firstName: 1, lastName: 1, role: 1, usageCount: 1 })
      .sort({ email: 1 })
      .lean();
    await sendUsersXlsx(res, "users.xlsx", users);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

export async function getAdminStats(_req: Request, res: Response) {
  try {
    const [totalUsers, totalLogs, usageAgg] = await Promise.all([
      UserModel.countDocuments({}),
      LogModel.countDocuments({}),
      UserModel.aggregate<{ sum: number }>([
        { $group: { _id: null, sum: { $sum: "$usageCount" } } },
      ]),
    ]);

    return res.status(200).json({
      totalUsers,
      totalLogs,
      usageCountSum: usageAgg[0]?.sum ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

export async function getAdminUsers(req: Request, res: Response) {
  try {
    const { page, limit, skip } = getPagination(req);

    const [total, users] = await Promise.all([
      UserModel.countDocuments({}),
      UserModel.find({})
        .select({ _id: 1, email: 1, firstName: 1, lastName: 1, role: 1, usageCount: 1 })
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.status(200).json({
      data: users,
      total,
      page,
      totalPages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

export async function getAdminLogs(req: Request, res: Response) {
  try {
    const { page, limit, skip } = getPagination(req);

    const userIdFilter =
      typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    const from =
      typeof req.query.from === "string" ? req.query.from.trim() : "";
    const to = typeof req.query.to === "string" ? req.query.to.trim() : "";

    const filter: {
      userId?: RegExp;
      createdAt?: { $gte?: Date; $lte?: Date };
    } = {};

    if (userIdFilter) {
      filter.userId = new RegExp(escapeRegex(userIdFilter), "i");
    }

    const createdRange: { $gte?: Date; $lte?: Date } = {};
    if (from) {
      const start = new Date(`${from}T00:00:00.000Z`);
      if (!Number.isNaN(start.getTime())) {
        createdRange.$gte = start;
      }
    }
    if (to) {
      const end = new Date(`${to}T23:59:59.999Z`);
      if (!Number.isNaN(end.getTime())) {
        createdRange.$lte = end;
      }
    }
    if (createdRange.$gte !== undefined || createdRange.$lte !== undefined) {
      filter.createdAt = createdRange;
    }

    const [total, logs] = await Promise.all([
      LogModel.countDocuments(filter),
      LogModel.find(filter)
        .sort({ createdAt: -1 })
        .select({ _id: 1, userId: 1, input: 1, output: 1, createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // Fetch user emails for all logs
    const userIds = [...new Set(logs.map(log => log.userId))];
    const users = await UserModel.find({ _id: { $in: userIds } })
      .select({ _id: 1, email: 1 })
      .lean();
    const userEmailMap = new Map(users.map(u => [u._id.toString(), u.email]));

    // Attach userEmail to each log
    const logsWithEmail = logs.map(log => ({
      ...log,
      userEmail: userEmailMap.get(log.userId) ?? "unknown",
    }));

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return res.status(200).json({
      data: logsWithEmail,
      total,
      page,
      totalPages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

export async function updateUserRole(req: Request, res: Response) {
  try {
    const { userId } = req.params as { userId?: string };
    const { role } = req.body as { role?: unknown };

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    if (role !== "admin" && role !== "user") {
      return res.status(400).json({ message: "role must be 'admin' or 'user'" });
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    )
      .select({ _id: 1, email: 1, firstName: 1, lastName: 1, role: 1, usageCount: 1 })
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

export async function deleteAdminLog(req: Request, res: Response) {
  try {
    const { logId } = req.params as { logId?: string };
    if (!logId) {
      return res.status(400).json({ message: "logId is required" });
    }

    const deleted = await LogModel.findByIdAndDelete(logId).lean();
    if (!deleted) {
      return res.status(404).json({ message: "Log not found" });
    }

    return res.status(200).json({ message: "Log deleted" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

export async function exportAdminLogs(req: Request, res: Response) {
  try {
    const logs = await LogModel.find({})
      .sort({ createdAt: -1 })
      .select({ userId: 1, input: 1, output: 1, createdAt: 1 })
      .lean();

    // Fetch user emails
    const userIds = [...new Set(logs.map(log => log.userId))];
    const users = await UserModel.find({ _id: { $in: userIds } })
      .select({ _id: 1, email: 1 })
      .lean();
    const userEmailMap = new Map(users.map(u => [u._id.toString(), u.email]));

    const header = ["userEmail", "input", "analysis", "fix", "createdAt"]
      .map(csvQuotedCell)
      .join(",");
    const rows = logs.map((log) => {
      let created = "";
      if (log.createdAt instanceof Date) {
        // Format as: 25-Mar-2026 02:17AM (compact for CSV)
        const date = log.createdAt;
        const day = date.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit" });
        const month = date.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", month: "short" });
        const year = date.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", year: "numeric" });
        const time = date.toLocaleTimeString("en-GB", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        }).replace(" ", ""); // Remove space between time and AM/PM
        created = `${day}-${month}-${year} ${time}`;
      } else {
        created = String(log.createdAt ?? "");
      }

      const userEmail = userEmailMap.get(log.userId) ?? "unknown";
      return [
        csvQuotedCell(userEmail),
        csvQuotedCell(log.input ?? ""),
        csvQuotedCell(log.output?.analysis ?? ""),
        csvQuotedCell(log.output?.fix ?? ""),
        csvQuotedCell(created),
      ].join(",");
    });
    const csv = withUtf8Bom([header, ...rows].join("\r\n"));

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="admin-logs.csv"'
    );
    return res.status(200).send(csv);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

export async function exportAdminLogsPdf(_req: Request, res: Response) {
  try {
    const logs = await LogModel.find({})
      .sort({ createdAt: -1 })
      .select({ userId: 1, input: 1, output: 1, createdAt: 1 })
      .lean();

    // Fetch user emails
    const userIds = [...new Set(logs.map(log => log.userId))];
    const users = await UserModel.find({ _id: { $in: userIds } })
      .select({ _id: 1, email: 1 })
      .lean();
    const userEmailMap = new Map(users.map(u => [u._id.toString(), u.email]));

    const logsWithEmail = logs.map(log => ({
      ...log,
      userEmail: userEmailMap.get(log.userId) ?? "unknown",
    }));

    streamAdminLogsPdf(res, logsWithEmail);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

export async function exportAdminLogsXlsx(_req: Request, res: Response) {
  try {
    const logs = await LogModel.find({})
      .sort({ createdAt: -1 })
      .select({ userId: 1, input: 1, output: 1, createdAt: 1 })
      .lean();

    // Fetch user emails
    const userIds = [...new Set(logs.map(log => log.userId))];
    const users = await UserModel.find({ _id: { $in: userIds } })
      .select({ _id: 1, email: 1 })
      .lean();
    const userEmailMap = new Map(users.map(u => [u._id.toString(), u.email]));

    const logsWithEmail = logs.map(log => ({
      ...log,
      userEmail: userEmailMap.get(log.userId) ?? "unknown",
    }));

    await sendAdminLogsXlsx(res, "admin-logs.xlsx", logsWithEmail);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

export async function deleteAdminUser(req: Request, res: Response) {
  try {
    const { userId } = req.params as { userId?: string };
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const deleted = await UserModel.findByIdAndDelete(userId).lean();
    if (!deleted) {
      return res.status(404).json({ message: "User not found" });
    }

    await LogModel.deleteMany({ userId });

    return res.status(200).json({ message: "User deleted" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

