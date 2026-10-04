import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { createWebHandler } from "../src/web-handler";

async function testApp() {
  const app = Fastify();
  app.get("/echo", async (req) => ({ query: req.query, cookie: req.headers.cookie ?? null }));
  app.post("/echo", async (req) => ({ body: req.body }));
  app.get("/cookies", async (_req, reply) => {
    reply.header("set-cookie", ["a=1; Path=/", "b=2; Path=/"]);
    return { ok: true };
  });
  app.delete("/empty", async (_req, reply) => reply.code(204).send());
  return app;
}

describe("createWebHandler", () => {
  it("serves /api/health from the real app", async () => {
    const handle = createWebHandler(() => buildApp());
    const res = await handle(new Request("https://proven.test/api/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("strips the prefix and forwards query and request headers", async () => {
    const handle = createWebHandler(testApp);
    const res = await handle(
      new Request("https://proven.test/api/echo?x=1", { headers: { cookie: "sid=abc" } }),
    );
    expect(await res.json()).toEqual({ query: { x: "1" }, cookie: "sid=abc" });
  });

  it("forwards a JSON body", async () => {
    const handle = createWebHandler(testApp);
    const res = await handle(
      new Request("https://proven.test/api/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hello: "dunia" }),
      }),
    );
    expect(await res.json()).toEqual({ body: { hello: "dunia" } });
  });

  it("keeps multiple set-cookie headers", async () => {
    const handle = createWebHandler(testApp);
    const res = await handle(new Request("https://proven.test/api/cookies"));
    expect(res.headers.getSetCookie()).toEqual(["a=1; Path=/", "b=2; Path=/"]);
  });

  it("returns an empty body for 204", async () => {
    const handle = createWebHandler(testApp);
    const res = await handle(new Request("https://proven.test/api/empty", { method: "DELETE" }));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("builds the app only once", async () => {
    let builds = 0;
    const handle = createWebHandler(async () => {
      builds += 1;
      return testApp();
    });
    await Promise.all([handle(new Request("https://p/api/echo")), handle(new Request("https://p/api/echo"))]);
    expect(builds).toBe(1);
  });
});
