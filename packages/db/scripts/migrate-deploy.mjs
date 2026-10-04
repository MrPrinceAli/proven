// Runs `prisma migrate deploy` during the Vercel build (D-019).
// Skips with a loud warning when no database is connected yet, so the site still builds.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL tidak di-set — migrasi dilewati. Sambungkan Neon di Vercel lalu redeploy.");
  process.exit(0);
}

const cwd = join(dirname(fileURLToPath(import.meta.url)), "..");
execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  cwd,
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  },
});
