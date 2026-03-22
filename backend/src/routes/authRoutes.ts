import { Router } from "express";
import { getMe, login, signup } from "../controllers/authController";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);

router.get("/me", requireAuth, getMe);

export default router;

