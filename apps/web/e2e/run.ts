// pnpm e2e: migrate the test DB, build Next with the e2e client env, then run Playwright.
// Needs Postgres (DATABASE_URL_TEST) and Anvil with `pnpm contracts:deploy:local` already done.
import { execFileSync } from "node:child_process";
import { e2eEnv } from "./env";

const env = {
  ...process.env,
  ...e2eEnv,
  DATABASE_URL_UNPOOLED: e2eEnv.DATABASE_URL,
  NEXT_TELEMETRY_DISABLED: "1",
};
const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { stdio: "inherit", env });

run("pnpm", ["--filter", "@proven/db", "migrate:deploy"]);
if (!process.argv.includes("--no-build")) run("pnpm", ["exec", "next", "build"]);
run("pnpm", ["exec", "playwright", "test", ...process.argv.slice(2).filter((a) => a !== "--no-build")]);
