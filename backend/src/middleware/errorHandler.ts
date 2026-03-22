import type { NextFunction, Request, Response } from "express";

// Basic error handler to keep API responses consistent.
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const message = err instanceof Error ? err.message : "Internal Server Error";

  res.status(500).json({ message });
}

