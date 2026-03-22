# AI DevOps Platform

## Project Overview

AI DevOps Platform is a full-stack web application that helps teams quickly analyze logs/code issues with AI assistance, track historical analyses, and monitor usage through dashboards and admin views.

The platform is designed for:

- Faster debugging and root-cause analysis
- Team visibility into analysis trends
- Secure role-based access for normal users and admins

## Features List

- Authentication and authorization
  - JWT-based signup/login
  - Protected routes
  - Admin-only APIs/pages
- AI analysis workflow
  - Submit logs/code snippets for analysis
  - View AI explanation + suggested fix
  - Copy fix to clipboard
- History and exports
  - Full history table with search
  - CSV export (UTF-8 BOM; plain CSV cannot store column widths in Excel)
  - Excel (.xlsx) export with **wide columns** and wrapped text
  - PDF export
  - Click row to open full log modal
- Dashboard and insights
  - Total logs count
  - Today's logs count
  - Usage count per user
  - Recent logs preview
  - Logs-per-day line chart
- UX enhancements
  - Toast notifications
  - Dark mode
  - Syntax-highlighted log/code blocks
  - Lazy-loaded heavy UI components for better performance

## Tech Stack

### Frontend

- React + TypeScript
- Vite
- Tailwind CSS
- React Router
- Recharts
- react-hot-toast
- react-syntax-highlighter
- jsPDF + jspdf-autotable

### Backend

- Node.js + Express + TypeScript
- MongoDB + Mongoose
- JWT (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- PDF export for admin (`pdfkit`)
- Excel exports with column widths (`exceljs`)
- OpenAI SDK integration point

## Screenshots

> Add actual image files under `docs/screenshots/` and keep these links updated for manager demos.

### Dashboard

![Dashboard](docs/screenshots/dashboard.png)

### Admin Page

![Admin](docs/screenshots/admin.png)

### History Modal

![History Modal](docs/screenshots/history-modal.png)

## Admin API (reference)

All routes require `Authorization: Bearer <token>` and **admin** role.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/stats` | `{ totalUsers, totalLogs, usageCountSum }` — global totals for dashboard cards |
| GET | `/api/admin/users?page=1&limit=10` | Paginated users: `{ data, total, page, totalPages }`. Defaults: `page=1`, `limit=10`; max `limit=100` |
| GET | `/api/admin/logs?page=1&limit=10` | Same JSON shape. Optional filters: `userId` (substring, case-insensitive), `from` / `to` (`YYYY-MM-DD`, UTC day bounds) |
| GET | `/api/admin/logs/export` | CSV of **all** logs: quoted fields, UTF-8 BOM (Excel-friendly), columns `userId`, `input`, `analysis`, `fix`, `createdAt` |
| GET | `/api/admin/logs/export/xlsx` | Excel workbook: same columns with **set column widths** and wrapped text (CSV cannot store column width) |
| GET | `/api/admin/logs/export/pdf` | PDF (landscape A4): fixed column widths for `userId`, `createdAt`, `input`, `analysis`, `fix` |
| GET | `/api/admin/users/export` | CSV: quoted fields + UTF-8 BOM; columns `email`, `firstName`, `lastName`, `role`, `usageCount` |
| GET | `/api/admin/users/export/xlsx` | Excel workbook: same user columns with **set column widths** and wrapped text |
| GET | `/api/admin/users/export/pdf` | PDF (landscape A4): same user fields with readable column widths |
| PATCH | `/api/admin/users/:userId/role` | Body: `{ "role": "admin" \| "user" }` |
| DELETE | `/api/admin/users/:userId` | Deletes user and their logs |
| DELETE | `/api/admin/logs/:logId` | Deletes a log |

`GET /api/admin/users/export`, `/export/pdf`, `/export/xlsx` (and the same under `/logs/`) are registered before parameterized routes so `export` is not parsed as an id.

### User dashboard APIs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/stats` | `{ totalLogsCount, todaysLogsCount, last5Logs, logsPerDay }` — `logsPerDay` is `[{ date: "YYYY-MM-DD", count }]` (UTC day) for the chart |
| GET | `/api/logs/history?page=1&limit=10&q=` | Paginated history for the signed-in user: `{ data, total, page, totalPages }`. Optional `q` searches input / analysis / fix (case-insensitive). Max `limit=100`. |
| GET | `/api/logs/export` | User’s full history as CSV (quoted fields, UTF-8 BOM for Excel) |
| GET | `/api/logs/export/xlsx` | Same data as Excel with **wide columns** for `input`, `analysis`, `fix`, `createdAt` |

### Auth (reference)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Body: `{ "firstName", "lastName", "email", "password" }` — names trimmed, 1–100 chars each; password min 8 |
| POST | `/api/auth/login` | Body: `{ "email", "password" }` — response `user` includes `firstName`, `lastName` |
| GET | `/api/auth/me` | Current user profile including `firstName`, `lastName` |

### Admin page URL query (shareable state)

The admin UI syncs list state to the address bar (defaults are omitted for a shorter URL):

| Query | Meaning |
|-------|---------|
| `userId` | Logs filter (substring match); debounced ~300ms after typing |
| `page` | Logs table page (default `1` → omitted) |
| `usersPage` | Users table page (default `1` → omitted) |
| `limit` | Rows per page for **both** tables: `10` (default), `20`, or `50` |
| `from` / `to` | Log date range (`YYYY-MM-DD`, UTC bounds) |

Example: `/admin?userId=test&page=2&limit=20`

### Log collection index

`Log` has a compound MongoDB index `{ userId: 1, createdAt: -1 }` for filtered admin log queries. After upgrading, ensure indexes are built (Mongoose creates them on connect, or run `syncIndexes` in a migration if you manage indexes manually).

### Frontend helpers

`frontend/src/services/api.ts`: `getAdminStats`, `getAdminUsers`, `getAdminLogs`, spreadsheet helpers `exportAdminUsersXlsx()` / `exportAdminUsersCsv()` / `exportAdminUsersPdf()` (and the same for admin logs), plus `exportLogsXlsx()` / `exportLogsCsv()`, `Paginated<T>` / `getHistory({ page, limit, q })`.

## How To Run

### 1) Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/ai
JWT_SECRET=replace_me_with_a_long_random_string
JWT_EXPIRES_IN=1d
BCRYPT_SALT_ROUNDS=10
OPENAI_API_KEY=replace_me_with_openai_key
OPENAI_MODEL=gpt-4o-mini
```

Run backend:

```bash
npm run dev
```

### 2) Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Run frontend:

```bash
npm run dev
```

### 3) Production Build (optional)

Backend:

```bash
cd backend
npm run build
```

Frontend:

```bash
cd frontend
npm run build
```

