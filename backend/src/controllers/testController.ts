import type { Request, Response } from "express";

export function getTest(req: Request, res: Response) {
  // Keep it exactly as requested.
  res.status(200).send("API working");
}

