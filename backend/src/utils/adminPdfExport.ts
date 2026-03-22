import PDFDocument from "pdfkit";
import type { Response } from "express";

const MARGIN = 40;
/** Landscape A4 inner height before new page */
const PAGE_BOTTOM = 520;

type LeanUser = {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  usageCount?: number;
};

type LeanLog = {
  userId: string;
  input?: string;
  output?: { analysis?: string; fix?: string } | null;
  createdAt?: Date;
};

function drawUsersHeader(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  startX: number,
  colWidths: number[],
  labels: string[]
) {
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827");
  let x = startX;
  for (let i = 0; i < labels.length; i++) {
    doc.text(labels[i]!, x + 4, y + 4, {
      width: colWidths[i]! - 8,
      lineBreak: false,
    });
    x += colWidths[i]!;
  }
  doc
    .moveTo(startX, y + 20)
    .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y + 20)
    .strokeColor("#9ca3af")
    .lineWidth(0.5)
    .stroke();
  doc.fillColor("#000000");
}

function drawUsersDataRow(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  startX: number,
  colWidths: number[],
  cells: string[],
  rowH: number
): void {
  let x = startX;
  doc.font("Helvetica").fontSize(8).fillColor("#1f2937");
  for (let i = 0; i < cells.length; i++) {
    doc.text(cells[i] ?? "", x + 4, y + 5, {
      width: colWidths[i]! - 8,
      height: rowH - 10,
      ellipsis: true,
    });
    x += colWidths[i]!;
  }
  doc
    .moveTo(startX, y + rowH)
    .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y + rowH)
    .strokeColor("#e5e7eb")
    .lineWidth(0.35)
    .stroke();
}

export function streamAdminUsersPdf(res: Response, users: LeanUser[]): void {
  const doc = new PDFDocument({
    margin: MARGIN,
    layout: "landscape",
    size: "A4",
    bufferPages: true,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="admin-users.pdf"');
  doc.pipe(res);

  const colWidths = [210, 100, 100, 72, 58];
  const labels = ["Email", "First name", "Last name", "Role", "Usage"];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const startX = MARGIN;

  doc.font("Helvetica-Bold").fontSize(15).fillColor("#4f46e5");
  doc.text("Admin — Users export", startX, MARGIN);
  doc.font("Helvetica").fontSize(9).fillColor("#6b7280");
  doc.text(
    `Generated: ${new Date().toISOString()}  ·  ${users.length} user(s)`,
    startX,
    MARGIN + 22
  );
  doc.fillColor("#000000");

  let y = MARGIN + 44;
  drawUsersHeader(doc, y, startX, colWidths, labels);
  y += 24;

  const ROW_H = 34;
  for (const u of users) {
    if (y + ROW_H > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN;
      drawUsersHeader(doc, y, startX, colWidths, labels);
      y += 24;
    }
    const cells = [
      u.email,
      u.firstName ?? "",
      u.lastName ?? "",
      u.role,
      String(u.usageCount ?? 0),
    ];
    drawUsersDataRow(doc, y, startX, colWidths, cells, ROW_H);
    y += ROW_H;
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#9ca3af")
      .text(
        `Page ${i + 1} of ${range.count}`,
        startX,
        doc.page.height - 24,
        { width: tableWidth, align: "center" }
      );
  }

  doc.end();
}

function drawLogsHeader(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  startX: number,
  colWidths: number[],
  labels: string[]
) {
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827");
  let x = startX;
  for (let i = 0; i < labels.length; i++) {
    doc.text(labels[i]!, x + 3, y + 3, {
      width: colWidths[i]! - 6,
      lineBreak: false,
    });
    x += colWidths[i]!;
  }
  doc
    .moveTo(startX, y + 18)
    .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y + 18)
    .strokeColor("#9ca3af")
    .lineWidth(0.5)
    .stroke();
  doc.fillColor("#000000");
}

function drawLogsDataRow(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  startX: number,
  colWidths: number[],
  cells: string[],
  rowH: number
): void {
  let x = startX;
  doc.font("Helvetica").fontSize(7).fillColor("#1f2937");
  for (let i = 0; i < cells.length; i++) {
    doc.text(cells[i] ?? "", x + 3, y + 4, {
      width: colWidths[i]! - 6,
      height: rowH - 8,
      ellipsis: true,
    });
    x += colWidths[i]!;
  }
  doc
    .moveTo(startX, y + rowH)
    .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y + rowH)
    .strokeColor("#e5e7eb")
    .lineWidth(0.35)
    .stroke();
}

export function streamAdminLogsPdf(res: Response, logs: LeanLog[]): void {
  const doc = new PDFDocument({
    margin: MARGIN,
    layout: "landscape",
    size: "A4",
    bufferPages: true,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="admin-logs.pdf"'
  );
  doc.pipe(res);

  // Wide text columns for log content; userId + date narrower
  const colWidths = [88, 92, 168, 168, 168];
  const labels = ["User ID", "Created (UTC)", "Input", "Analysis", "Fix"];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const startX = MARGIN;

  doc.font("Helvetica-Bold").fontSize(15).fillColor("#4f46e5");
  doc.text("Admin — Logs export", startX, MARGIN);
  doc.font("Helvetica").fontSize(9).fillColor("#6b7280");
  doc.text(
    `Generated: ${new Date().toISOString()}  ·  ${logs.length} log(s)`,
    startX,
    MARGIN + 22
  );
  doc.fillColor("#000000");

  let y = MARGIN + 44;
  drawLogsHeader(doc, y, startX, colWidths, labels);
  y += 22;

  const ROW_H = 52;
  for (const log of logs) {
    if (y + ROW_H > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN;
      drawLogsHeader(doc, y, startX, colWidths, labels);
      y += 22;
    }
    const created =
      log.createdAt instanceof Date
        ? log.createdAt.toISOString()
        : String(log.createdAt ?? "");
    const cells = [
      log.userId,
      created,
      log.input ?? "",
      log.output?.analysis ?? "",
      log.output?.fix ?? "",
    ];
    drawLogsDataRow(doc, y, startX, colWidths, cells, ROW_H);
    y += ROW_H;
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#9ca3af")
      .text(
        `Page ${i + 1} of ${range.count}`,
        startX,
        doc.page.height - 24,
        { width: tableWidth, align: "center" }
      );
  }

  doc.end();
}
