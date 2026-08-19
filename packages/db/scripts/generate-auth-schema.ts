import dotenv from "dotenv";

dotenv.config({ path: "../../apps/server/.env" });

const result = Bun.spawnSync([
  "bun",
  "x",
  "--bun",
  "auth@latest",
  "generate",
  "--config",
  "../../packages/auth/src/index.ts",
  "--output",
  "../../packages/db/src/schema/auth.ts",
  "--yes",
], { env: process.env });

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exit(result.exitCode ?? 1);
