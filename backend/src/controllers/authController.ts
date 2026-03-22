import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { sign, type SignOptions } from "jsonwebtoken";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { UserModel } from "../models/User";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Misconfiguration: fail fast with a clear message.
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parsePersonName(value: unknown):
  | { ok: true; value: string }
  | { ok: false; reason: "missing" | "too_long" } {
  if (typeof value !== "string") {
    return { ok: false, reason: "missing" };
  }
  const t = value.trim();
  if (t.length < 1) {
    return { ok: false, reason: "missing" };
  }
  if (t.length > 100) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, value: t };
}

export async function signup(req: Request, res: Response) {
  try {
    const { email, password, firstName, lastName } = req.body as {
      email?: unknown;
      password?: unknown;
      firstName?: unknown;
      lastName?: unknown;
    };

    if (typeof email !== "string" || email.trim().length === 0) {
      return res.status(400).json({ message: "Email is required" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password is required (min 8 characters)" });
    }

    const fn = parsePersonName(firstName);
    const ln = parsePersonName(lastName);
    if (!fn.ok) {
      const msg =
        fn.reason === "too_long"
          ? "First name must be at most 100 characters"
          : "First name is required";
      return res.status(400).json({ message: msg });
    }
    if (!ln.ok) {
      const msg =
        ln.reason === "too_long"
          ? "Last name must be at most 100 characters"
          : "Last name is required";
      return res.status(400).json({ message: msg });
    }

    const normalizedEmail = normalizeEmail(email);

    const existing = await UserModel.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: "User already exists" });
    }

    const user = new UserModel({
      email: normalizedEmail,
      firstName: fn.value,
      lastName: ln.value,
      password, // hashed by model pre-save hook
      // role defaults to "user"
    });
    await user.save();

    return res.status(201).json({
      message: "Signup successful",
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (err) {
    // Handle duplicate key race condition.
    if (
      typeof err === "object" &&
      err &&
      "code" in err &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err as any).code === 11000
    ) {
      return res.status(409).json({ message: "User already exists" });
    }

    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body as {
      email?: unknown;
      password?: unknown;
    };

    if (typeof email !== "string" || email.trim().length === 0) {
      return res.status(400).json({ message: "Email is required" });
    }
    if (typeof password !== "string" || password.length === 0) {
      return res.status(400).json({ message: "Password is required" });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await UserModel.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const jwtSecret = getJwtSecret();
    const expiresIn = (process.env.JWT_EXPIRES_IN ?? "1d") as SignOptions["expiresIn"];

    const token = sign(
      { sub: user._id.toString(), email: user.email, role: user.role },
      jwtSecret,
      { expiresIn } satisfies SignOptions
    );

    return res.status(200).json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        role: user.role,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await UserModel.findById(userId)
      .select({ _id: 1, email: 1, firstName: 1, lastName: 1, role: 1, usageCount: 1 })
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        role: user.role,
        usageCount: user.usageCount ?? 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

