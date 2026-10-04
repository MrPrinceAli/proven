// Applies migrations to the test database (DATABASE_URL_TEST). Skips when it is not set, unless CI=true.
import { execFileSync } from "node:child_process";

const url = process.env.DATABASE_URL_TEST;
if (!url) {
  if (process.env.CI) {
    console.error("DATABASE_URL_TEST wajib di CI");
    process.exit(1);
  }
  console.warn("DATABASE_URL_TEST tidak di-set — migrasi test dilewati");
  process.exit(0);
}

execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
});
