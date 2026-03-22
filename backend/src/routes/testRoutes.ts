import { Router } from "express";
import { getTest } from "../controllers/testController";

const router = Router();

router.get("/test", getTest);

export default router;

