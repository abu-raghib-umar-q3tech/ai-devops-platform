import { Router } from "express";
import { exportLogsCsv, exportLogsXlsx, getLogs } from "../controllers/logController";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/history", requireAuth, getLogs);
router.get("/export", requireAuth, exportLogsCsv);
router.get("/export/xlsx", requireAuth, exportLogsXlsx);

export default router;

