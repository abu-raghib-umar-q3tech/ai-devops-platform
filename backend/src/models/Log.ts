import { Schema, model, type InferSchemaType } from "mongoose";

const LogSchema = new Schema(
  {
    userId: { type: String, required: true },
    input: { type: String, required: true, trim: true },
    output: {
      analysis: { type: String, required: true },
      fix: { type: String, required: true },
    },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false }
);

/** Supports admin filters (userId + sort by createdAt) at scale */
LogSchema.index({ userId: 1, createdAt: -1 });

export type LogDoc = InferSchemaType<typeof LogSchema>;
export const LogModel = model<LogDoc>("Log", LogSchema);

