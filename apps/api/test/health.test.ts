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
