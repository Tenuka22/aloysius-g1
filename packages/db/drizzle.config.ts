import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

// The app is a single service now; its env file is the only one.
dotenv.config({
  path: "../../apps/web/.env",
});

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
