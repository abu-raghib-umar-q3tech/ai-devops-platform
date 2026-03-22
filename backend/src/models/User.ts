import bcrypt from "bcryptjs";
import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    firstName: { type: String, default: "", trim: true },
    lastName: { type: String, default: "", trim: true },
    password: { type: String, required: true },
    role: { type: String, default: "user", required: true },
    usageCount: { type: Number, default: 0, required: true },
  },
  { versionKey: false }
);

export type UserDoc = InferSchemaType<typeof UserSchema>;
export type UserDocument = HydratedDocument<UserDoc>;

UserSchema.pre("save", async function () {
  // Only hash when the password is newly set or changed.
  const user = this as UserDocument;
  if (!user.isModified("password")) return;

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
  user.password = await bcrypt.hash(user.password, saltRounds);
});

export const UserModel = model<UserDoc>("User", UserSchema);

