import ExcelJS from "exceljs";
import type { Response } from "express";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF4F46E5" },
};

function applyHeaderRow(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = HEADER_FILL;
  row.height = 22;
  row.alignment = { vertical: "middle", wrapText: true };
}

function applyBodyColumnStyle(sheet: ExcelJS.Worksheet, fromCol: number, toCol: number) {
  for (let c = fromCol; c <= toCol; c++) {
    const col = sheet.getColumn(c);
    col.alignment = { wrapText: true, vertical: "top" };
  }
}

type UserRow = {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  usageCount?: number;
};

/** Admin users — wide columns for readability in Excel */
export async function sendUsersXlsx(
  res: Response,
  filename: string,
  users: UserRow[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AI DevOps Platform";
  const sheet = workbook.addWorksheet("Users", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Email", key: "email", width: 40 },
    { header: "First name", key: "firstName", width: 24 },
    { header: "Last name", key: "lastName", width: 24 },
    { header: "Role", key: "role", width: 16 },
    { header: "Usage count", key: "usageCount", width: 16 },
  ];

  for (const u of users) {
    sheet.addRow({
      email: u.email,
      firstName: u.firstName ?? "",
      lastName: u.lastName ?? "",
      role: u.role,
      usageCount: u.usageCount ?? 0,
    });
  }

  applyHeaderRow(sheet);
  applyBodyColumnStyle(sheet, 1, 5);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
}

type AdminLogRow = {
  userId: string;
  input?: string;
  output?: { analysis?: string; fix?: string } | null;
  createdAt?: Date;
};

/** Admin logs — wide text columns */
export async function sendAdminLogsXlsx(
  res: Response,
  filename: string,
  logs: AdminLogRow[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AI DevOps Platform";
  const sheet = workbook.addWorksheet("Logs", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "User Email", key: "userEmail", width: 30 },
    { header: "Created", key: "createdAt", width: 26 },
    { header: "Input", key: "input", width: 65 },
    { header: "Analysis", key: "analysis", width: 65 },
    { header: "Fix", key: "fix", width: 65 },
  ];

  for (const log of logs) {
    // Format date matching UI: "25 Mar 2026, 2:17 AM"
    const created =
      log.createdAt instanceof Date
        ? log.createdAt.toLocaleString("en-GB", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true
        })
        : String(log.createdAt ?? "");
    sheet.addRow({
      userEmail: (log as any).userEmail ?? log.userId,
      createdAt: created,
      input: log.input ?? "",
      analysis: log.output?.analysis ?? "",
      fix: log.output?.fix ?? "",
    });
  }

  applyHeaderRow(sheet);
  applyBodyColumnStyle(sheet, 1, 5);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
}

type UserLogRow = {
  input?: string;
  output?: { analysis?: string; fix?: string } | null;
  createdAt?: Date;
};

/** Signed-in user's history */
export async function sendUserLogsXlsx(
  res: Response,
  filename: string,
  logs: UserLogRow[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AI DevOps Platform";
  const sheet = workbook.addWorksheet("My logs", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Input", key: "input", width: 70 },
    { header: "Analysis", key: "analysis", width: 70 },
    { header: "Fix", key: "fix", width: 70 },
    { header: "Created", key: "createdAt", width: 26 },
  ];

  for (const log of logs) {
    // Format date matching UI: "25 Mar 2026, 2:17 AM"
    const created =
      log.createdAt instanceof Date
        ? log.createdAt.toLocaleString("en-GB", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true
        })
        : String(log.createdAt ?? "");
    sheet.addRow({
      input: log.input ?? "",
      analysis: log.output?.analysis ?? "",
      fix: log.output?.fix ?? "",
      createdAt: created,
    });
  }

  applyHeaderRow(sheet);
  applyBodyColumnStyle(sheet, 1, 4);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
}
