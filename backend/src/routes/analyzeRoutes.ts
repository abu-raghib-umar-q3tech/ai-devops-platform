import { Router } from "express";
import { analyzeInput } from "../controllers/analyzeController";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.post("/", requireAuth, analyzeInput);

export default router;

