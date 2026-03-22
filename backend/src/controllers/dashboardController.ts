import type { Response } from "express";
import { LogModel } from "../models/Log";
import type { AuthenticatedRequest } from "../middleware/requireAuth";

export async function getDashboardStats(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
    const startOfTomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      0
    );

    const [totalLogsCount, todaysLogsCount, last5Logs, logsPerDayRaw] =
      await Promise.all([
        LogModel.countDocuments({ userId }),
        LogModel.countDocuments({
          userId,
          createdAt: { $gte: startOfToday, $lt: startOfTomorrow },
        }),
        LogModel.find({ userId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select({ _id: 0, input: 1, output: 1, createdAt: 1 })
          .lean(),
        LogModel.aggregate<{ _id: string; count: number }>([
          { $match: { userId } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

    const logsPerDay = logsPerDayRaw.map((row) => ({
      date: row._id,
      count: row.count,
    }));

    return res.status(200).json({
      totalLogsCount,
      todaysLogsCount,
      last5Logs,
      logsPerDay,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

