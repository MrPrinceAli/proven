import { afterAll, describe, expect, it } from "vitest";
import { testApp } from "./helpers";

describe("GET /health", () => {
  const appPromise = testApp();

  afterAll(async () => (await appPromise).close());

  it("returns status ok", async () => {
    const app = await appPromise;
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("answers unknown routes with an RFC 9457 problem", async () => {
    const app = await appPromise;
    const res = await app.inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.json()).toMatchObject({
      type: "https://proven.app/problems/not-found",
      title: "Not found",
      status: 404,
      instance: "/nope",
    });
  });
});

describe("rate limiting", () => {
  it("answers 429 problem+json once the SIWE limit is exceeded", async () => {
    const app = await testApp({}, { max: 1000, authMax: 2 });
    const hit = () =>
      app.inject({ method: "POST", url: "/auth/siwe/nonce", payload: { address: "0x0", chainId: 97 } });
    await hit();
    await hit();
    const res = await hit();
    expect(res.statusCode).toBe(429);
    expect(res.json().type).toBe("https://proven.app/problems/rate-limited");
    await app.close();
  });
});
