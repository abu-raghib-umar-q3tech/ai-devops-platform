import type { NextFunction, Request, Response } from "express";
import { verify, type JwtPayload } from "jsonwebtoken";
import { UserModel } from "../models/User";

export type JwtUser = {
  id: string;
  email: string;
  role: string;
};

export type AuthenticatedRequest = Request & {
  user?: JwtUser;
};

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ message: "Server misconfigured" });
  }

  try {
    const decoded = verify(token, secret) as JwtPayload & {
      sub?: string;
      email?: string;
      role?: string;
    };

    if (!decoded.sub || !decoded.email || !decoded.role) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Check current role from database for immediate role changes
    const user = await UserModel.findById(req.user.id)
      .select({ role: 1 })
      .lean();

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden - Admin access required" });
    }

    // Update req.user with current role from database
    req.user.role = user.role;
    return next();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Authorization failed";
    return res.status(500).json({ message });
  }
}

