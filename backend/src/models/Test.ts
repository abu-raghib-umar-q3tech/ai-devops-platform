import { Schema, model, type InferSchemaType } from "mongoose";

const TestSchema = new Schema(
  {
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false }
);

export type TestDoc = InferSchemaType<typeof TestSchema>;
export const TestModel = model<TestDoc>("Test", TestSchema);

