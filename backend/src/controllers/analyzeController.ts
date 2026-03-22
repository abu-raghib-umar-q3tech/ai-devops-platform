import type { Response } from "express";
import OpenAI from "openai";
import { LogModel } from "../models/Log";
import { UserModel } from "../models/User";
import type { AuthenticatedRequest } from "../middleware/requireAuth";

type AiAnalysisResult = {
  analysis: string;
  fix: string;
};

function getOpenAiClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ apiKey });
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function fallbackParse(text: string): AiAnalysisResult {
  // If the model doesn't return strict JSON, keep service resilient.
  const lines = text.trim();
  return {
    analysis: lines || "Unable to parse analysis response.",
    fix: "Review logs/code, then apply the recommended changes safely.",
  };
}

/** Rule-based analysis when OpenAI is disabled; uses lowercase heuristics on the raw input. */
function smartFallback(input: string): AiAnalysisResult {
  const t = input.toLowerCase();

  if (
    t.includes("referenceerror") ||
    t.includes("is not defined") ||
    t.includes("can't find variable") ||
    t.includes("cannot find name")
  ) {
    return {
      analysis:
        "This points to a ReferenceError: the runtime is using an identifier (variable, function, or import) that was never declared or is out of scope in this context.",
      fix:
        "Confirm the name spelling, ensure the symbol is declared before use, add missing imports, and check that the code runs in the environment where that binding exists (e.g. browser vs Node).",
    };
  }

  if (
    t.includes("typeerror") ||
    t.includes("cannot read properties of") ||
    t.includes("cannot read property") ||
    t.includes("is not a function") ||
    t.includes("is not iterable") ||
    t.includes(".map is not a function") ||
    t.includes("undefined is not an object")
  ) {
    return {
      analysis:
        "This matches a TypeError: a value is the wrong type or shape for the operation (e.g. calling something that is not a function, or reading a property on null/undefined).",
      fix:
        "Trace where the value comes from, add guards or default values, validate API responses and JSON parsing, and ensure async data is loaded before use.",
    };
  }

  if (
    t.includes("syntaxerror") ||
    t.includes("unexpected token") ||
    t.includes("unexpected identifier") ||
    t.includes("invalid syntax") ||
    t.includes("parse error")
  ) {
    return {
      analysis:
        "This indicates a SyntaxError: the source could not be parsed—often a typo, stray character, or invalid JSON/JS/TS structure.",
      fix:
        "Fix brackets/quotes/commas, run the linter/formatter, validate JSON with a parser, and ensure template literals and regex literals are closed correctly.",
    };
  }

  if (
    t.includes("mongo") ||
    t.includes("mongoose") ||
    t.includes("e11000") ||
    t.includes("duplicate key") ||
    t.includes("mongodb") ||
    t.includes("server selection timed out") ||
    t.includes("topology") ||
    t.includes("mongoservererror") ||
    t.includes("mongoerror")
  ) {
    return {
      analysis:
        "The text suggests a MongoDB/Mongoose issue: connectivity, schema validation, duplicate unique keys, or driver/server errors.",
      fix:
        "Verify MONGO_URI/MONGODB_URI and network access, check unique indexes and payloads for duplicates, review schema types and required fields, and confirm the server version matches driver expectations.",
    };
  }

  if (
    t.includes("econnrefused") ||
    t.includes("enotfound") ||
    t.includes("network error") ||
    t.includes("fetch failed") ||
    t.includes("axioserror") ||
    t.includes("request failed") ||
    t.includes("socket hang up") ||
    t.includes("etimedout") ||
    t.includes("timeout") ||
    t.includes("status code 5") ||
    t.includes("status code 4") ||
    t.includes(" 404 ") ||
    t.includes(" 500 ") ||
    t.includes(" 502 ") ||
    t.includes(" 503 ") ||
    t.includes("failed to fetch") ||
    t.includes("cors")
  ) {
    return {
      analysis:
        "Patterns here align with network or HTTP/API failures: DNS, refused connections, timeouts, or non-success status codes.",
      fix:
        "Confirm the base URL, TLS/certs, and firewall; retry with backoff; inspect server logs; verify auth headers and CORS if the browser is involved; mock or stub dependencies in tests.",
    };
  }

  return {
    analysis:
      "No single error keyword matched strongly. Treat the input as a generic runtime, configuration, or integration issue until you narrow it with stack traces and context.",
    fix:
      "Reproduce with minimal steps, capture the full stack trace and environment (runtime version, OS), bisect recent changes, and add logging around the failing boundary.",
  };
}

function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/** OpenAI path; throws if the model response cannot be turned into analysis + fix. */
async function analyzeWithOpenAi(input: string): Promise<AiAnalysisResult> {
  const client = getOpenAiClient();
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You are a senior software debugging assistant. Return ONLY valid JSON object with exactly two keys: analysis and fix. Keep both concise and actionable.",
      },
      {
        role: "user",
        content:
          "Analyze the following log/code issue. Explain the issue, identify errors, and suggest fixes.\n\nInput:\n" +
          input,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  if (!content.trim()) {
    throw new Error("Empty AI response");
  }

  let candidate: AiAnalysisResult;
  try {
    const json = JSON.parse(content) as Partial<AiAnalysisResult>;
    candidate = {
      analysis: normalizeText(json.analysis),
      fix: normalizeText(json.fix),
    };
    if (!candidate.analysis || !candidate.fix) {
      candidate = fallbackParse(content);
    }
  } catch {
    candidate = fallbackParse(content);
  }

  if (!candidate.analysis || !candidate.fix) {
    throw new Error("Incomplete AI response");
  }

  return candidate;
}

export async function analyzeInput(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const input = normalizeText((req.body as { input?: unknown })?.input);
    if (!input) {
      return res.status(400).json({ message: "input is required" });
    }

    const existing = await LogModel.findOne({ input }).lean();
    if (existing?.output?.analysis && existing?.output?.fix) {
      return res.status(200).json({
        analysis: existing.output.analysis,
        fix: existing.output.fix,
      });
    }

    let parsed: AiAnalysisResult;
    if (isDemoMode()) {
      parsed = smartFallback(input);
    } else {
      try {
        parsed = await analyzeWithOpenAi(input);
      } catch {
        parsed = smartFallback(input);
      }
    }

    await Promise.all([
      LogModel.create({
        userId: req.user.id,
        input,
        output: parsed,
      }),
      UserModel.findByIdAndUpdate(req.user.id, { $inc: { usageCount: 1 } }),
    ]);

    return res.status(200).json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return res.status(500).json({ message });
  }
}

