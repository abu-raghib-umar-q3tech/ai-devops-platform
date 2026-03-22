import { Router } from "express";
import {
  deleteAdminUser,
  deleteAdminLog,
  exportAdminLogs,
  exportAdminLogsPdf,
  exportAdminLogsXlsx,
  exportAdminUsers,
  exportAdminUsersPdf,
  exportAdminUsersXlsx,
  getAdminLogs,
  getAdminStats,
  getAdminUsers,
  updateUserRole,
} from "../controllers/adminController";
import { requireAdmin, requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/users/export", requireAuth, requireAdmin, exportAdminUsers);
router.get("/users/export/pdf", requireAuth, requireAdmin, exportAdminUsersPdf);
router.get("/users/export/xlsx", requireAuth, requireAdmin, exportAdminUsersXlsx);
router.get("/logs/export", requireAuth, requireAdmin, exportAdminLogs);
router.get("/logs/export/pdf", requireAuth, requireAdmin, exportAdminLogsPdf);
router.get("/logs/export/xlsx", requireAuth, requireAdmin, exportAdminLogsXlsx);
router.get("/stats", requireAuth, requireAdmin, getAdminStats);
router.get("/users", requireAuth, requireAdmin, getAdminUsers);
router.get("/logs", requireAuth, requireAdmin, getAdminLogs);
router.patch("/users/:userId/role", requireAuth, requireAdmin, updateUserRole);
router.delete("/users/:userId", requireAuth, requireAdmin, deleteAdminUser);
router.delete("/logs/:logId", requireAuth, requireAdmin, deleteAdminLog);

export default router;

