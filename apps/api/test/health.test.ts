import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

describe("GET /health", () => {
  const appPromise = buildApp();

  afterAll(async () => (await appPromise).close());

  it("returns status ok", async () => {
    const app = await appPromise;
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});
