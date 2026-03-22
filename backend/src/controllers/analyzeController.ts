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

export async function analyzeInput(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const input = normalizeText((req.body as { input?: unknown })?.input);
    if (!input) {
      return res.status(400).json({ message: "input is required" });
    }

    // TODO: Disable OpenAI temporarily (quota issue)
    // const client = getOpenAiClient();

    // const completion = await client.chat.completions.create({
    //   model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    //   temperature: 0.2,
    //   messages: [
    //     {
    //       role: "system",
    //       content:
    //         "You are a senior software debugging assistant. Return ONLY valid JSON object with exactly two keys: analysis and fix. Keep both concise and actionable.",
    //     },
    //     {
    //       role: "user",
    //       content:
    //         "Analyze the following log/code issue. Explain the issue, identify errors, and suggest fixes.\n\nInput:\n" +
    //         input,
    //     },
    //   ],
    // });

    // const content = completion.choices[0]?.message?.content ?? "";

    // TODO: Temporary mock AI response (replace with OpenAI later)
    const parsed: AiAnalysisResult = {
      analysis:
        "This error occurs because an undefined variable is being accessed.",
      fix:
        "Ensure the variable exists before accessing properties like .length. Add null/undefined checks.",
    };

    // let parsed: AiAnalysisResult;
    // try {
    //   const json = JSON.parse(content) as Partial<AiAnalysisResult>;
    //   parsed = {
    //     analysis: normalizeText(json.analysis),
    //     fix: normalizeText(json.fix),
    //   };
    //   if (!parsed.analysis || !parsed.fix) {
    //     parsed = fallbackParse(content);
    //   }
    // } catch {
    //   parsed = fallbackParse(content);
    // }

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

