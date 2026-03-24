import mongoose from "mongoose";
import dotenv from "dotenv";
import { app } from "./app";

dotenv.config();

async function main() {
  const port = Number(process.env.PORT ?? 5000);
  const mongoUri =
    process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/ai";

  try {
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

main();

