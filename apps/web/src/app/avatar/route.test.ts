import { describe, expect, it } from "vitest";
import { GET } from "./[seed]/route";

describe("GET /avatar/[seed]", () => {
  it("renders a cacheable SVG for a valid seed", async () => {
    const res = GET(new Request("http://x/avatar/pv-0"), { params: { seed: "pv-0" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(await res.text()).toMatch(/^<svg/);
  });

  it("is deterministic", async () => {
    const a = await GET(new Request("http://x"), { params: { seed: "pv-7" } }).text();
    const b = await GET(new Request("http://x"), { params: { seed: "pv-7" } }).text();
    expect(a).toBe(b);
  });

  it("rejects seeds outside the allowed alphabet", () => {
    expect(GET(new Request("http://x"), { params: { seed: "<script>" } }).status).toBe(404);
  });
});
