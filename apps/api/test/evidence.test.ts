import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../src/evidence/crypto";
import { detectMime } from "../src/evidence/mime";
import { MAX_EVIDENCE_BYTES } from "../src/routes/evidence";
import { PDF, hasDatabase, loginAs, multipart, resetDatabase, testApp, testPrisma, upload } from "./helpers";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const EXE = Buffer.from("MZ\x90\x00\x03\x00\x00\x00This program cannot be run in DOS mode", "binary");
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

describe("evidence helpers", () => {
  it("detects PDF, PNG and JPG by magic bytes and rejects everything else", () => {
    expect(detectMime(PDF)).toBe("application/pdf");
    expect(detectMime(PNG)).toBe("image/png");
    expect(detectMime(JPG)).toBe("image/jpeg");
    expect(detectMime(EXE)).toBeNull();
    expect(detectMime(Buffer.from("%PD"))).toBeNull();
  });

  it("round-trips AES-256-GCM with a fresh IV and detects tampering", () => {
    const key = Buffer.alloc(32, 1);
    const a = encrypt(key, PDF);
    const b = encrypt(key, PDF);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext.equals(PDF)).toBe(false);
    expect(decrypt(key, a).equals(PDF)).toBe(true);

    const tampered = Buffer.from(a.ciphertext);
    tampered[0] = tampered[0]! ^ 0xff;
    expect(() => decrypt(key, { ...a, ciphertext: tampered })).toThrow();
  });
});

describe.skipIf(!hasDatabase)("evidence API (FR-04)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await testApp();
  });
  afterAll(() => app.close());
  beforeEach(() => resetDatabase());

  it("records the SHA-256 of the original file and stores only ciphertext", async () => {
    const { cookies, userId } = await loginAs(app);
    const res = await upload(app, cookies, PDF, "sertifikat.pdf", {
      title: "Sertifikat juara",
      type: "hackathon",
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      sha256: sha(PDF),
      mimeType: "application/pdf",
      sizeBytes: PDF.length,
      type: "hackathon",
      title: "Sertifikat juara",
      filename: "sertifikat.pdf",
      links: [],
    });
    expect(body.custody).toEqual([
      { event: "uploaded", at: expect.any(String), by: userId, sha256: sha(PDF) },
    ]);
    expect(body).not.toHaveProperty("storageKey");

    const blob = await testPrisma().evidenceBlob.findFirstOrThrow();
    expect(Buffer.from(blob.ciphertext).includes(Buffer.from("%PDF"))).toBe(false);

    const log = await testPrisma().auditLog.findFirstOrThrow({ where: { action: "evidence.uploaded" } });
    expect(log.after).toMatchObject({ sha256: sha(PDF), size: PDF.length, mime: "application/pdf" });
  });

  it("produces the same hash for the same file (deterministic)", async () => {
    const { cookies } = await loginAs(app);
    const a = (await upload(app, cookies)).json();
    const b = (await upload(app, cookies)).json();
    expect(a.sha256).toBe(b.sha256);
    expect(a.id).not.toBe(b.id);
  });

  it("accepts PNG and JPG", async () => {
    const { cookies } = await loginAs(app);
    expect((await upload(app, cookies, PNG, "foto.png")).json().mimeType).toBe("image/png");
    expect((await upload(app, cookies, JPG, "foto.jpg")).json().mimeType).toBe("image/jpeg");
  });

  it("rejects a file of 4 MB + 1 byte with 413", async () => {
    const { cookies } = await loginAs(app);
    const big = Buffer.alloc(MAX_EVIDENCE_BYTES + 1, 0x20);
    PDF.copy(big);
    const res = await upload(app, cookies, big, "besar.pdf");
    expect(res.statusCode).toBe(413);
    expect(res.json().type).toBe("https://proven.app/problems/payload-too-large");
    expect(await testPrisma().evidence.count()).toBe(0);
  });

  it("accepts a file of exactly 4 MB", async () => {
    const { cookies } = await loginAs(app);
    const max = Buffer.alloc(MAX_EVIDENCE_BYTES, 0x20);
    PDF.copy(max);
    expect((await upload(app, cookies, max, "pas.pdf")).statusCode).toBe(201);
  });

  it("rejects an .exe renamed to .pdf with 415", async () => {
    const { cookies } = await loginAs(app);
    const body = await multipart({ data: EXE, filename: "sertifikat.pdf", type: "application/pdf" });
    const res = await app.inject({ method: "POST", url: "/me/evidence", cookies, ...body });
    expect(res.statusCode).toBe(415);
    expect(res.json().type).toBe("https://proven.app/problems/unsupported-media-type");
  });

  it("rejects an unknown evidence type and a missing file", async () => {
    const { cookies } = await loginAs(app);
    expect((await upload(app, cookies, PDF, "a.pdf", { type: "selfie" })).statusCode).toBe(400);
    const noFile = await app.inject({
      method: "POST",
      url: "/me/evidence",
      cookies,
      payload: { title: "x" },
    });
    expect(noFile.statusCode).toBe(415);
  });

  it("downloads the decrypted file and verifies its integrity", async () => {
    const { cookies } = await loginAs(app);
    const { id } = (await upload(app, cookies)).json();

    const res = await app.inject({ method: "GET", url: `/me/evidence/${id}/download`, cookies });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["x-content-sha256"]).toBe(sha(PDF));
    expect(res.rawPayload.equals(PDF)).toBe(true);
  });

  it("answers 409 integrity-mismatch when the stored ciphertext was altered", async () => {
    const { cookies } = await loginAs(app);
    const { id } = (await upload(app, cookies)).json();
    const blob = await testPrisma().evidenceBlob.findFirstOrThrow();
    const altered = Buffer.from(blob.ciphertext);
    altered[0] = altered[0]! ^ 0x01;
    await testPrisma().evidenceBlob.update({ where: { id: blob.id }, data: { ciphertext: altered } });

    const res = await app.inject({ method: "GET", url: `/me/evidence/${id}/download`, cookies });
    expect(res.statusCode).toBe(409);
    expect(res.json().type).toBe("https://proven.app/problems/integrity-mismatch");
  });

  it("answers 409 integrity-mismatch when the recorded hash does not match", async () => {
    const { cookies } = await loginAs(app);
    const { id } = (await upload(app, cookies)).json();
    await testPrisma().evidence.update({ where: { id }, data: { sha256: Buffer.alloc(32) } });

    const res = await app.inject({ method: "GET", url: `/me/evidence/${id}/download`, cookies });
    expect(res.statusCode).toBe(409);
  });

  it("hides another user's evidence behind 404", async () => {
    const alice = await loginAs(app);
    const bob = await loginAs(app);
    const { id } = (await upload(app, alice.cookies)).json();

    const requests = [
      { method: "GET" as const, url: `/me/evidence/${id}/download` },
      { method: "PATCH" as const, url: `/me/evidence/${id}`, payload: { type: "award" } },
      { method: "DELETE" as const, url: `/me/evidence/${id}` },
    ];
    for (const r of requests) {
      expect((await app.inject({ ...r, cookies: bob.cookies })).statusCode).toBe(404);
    }
    expect((await app.inject({ method: "GET", url: "/me/evidence", cookies: bob.cookies })).json()).toEqual(
      [],
    );
  });

  it("lets the owner correct the type and title", async () => {
    const { cookies } = await loginAs(app);
    const { id } = (await upload(app, cookies)).json();
    const res = await app.inject({
      method: "PATCH",
      url: `/me/evidence/${id}`,
      cookies,
      payload: { type: "award", title: "Piagam" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ type: "award", title: "Piagam", sha256: sha(PDF) });
  });

  describe("links and claim status", () => {
    async function achievementWithEvidence() {
      const owner = await loginAs(app);
      const achievement = (
        await app.inject({
          method: "POST",
          url: "/me/achievements",
          cookies: owner.cookies,
          payload: { title: "XYZ Hackathon 2026 — Winner" },
        })
      ).json();
      const evidence = (await upload(app, owner.cookies)).json();
      return { ...owner, achievement, evidence };
    }

    const link = (
      cookies: Record<string, string>,
      evidenceId: string,
      entityId: string,
      entityType = "achievement",
    ) =>
      app.inject({
        method: "POST",
        url: `/me/evidence/${evidenceId}/links`,
        cookies,
        payload: { entityType, entityId },
      });

    it("linking evidence moves the claim to EVIDENCE_ATTACHED", async () => {
      const { cookies, achievement, evidence } = await achievementWithEvidence();
      const res = await link(cookies, evidence.id, achievement.id);
      expect(res.statusCode).toBe(201);
      expect(res.json().status).toBe("EVIDENCE_ATTACHED");

      const list = (await app.inject({ method: "GET", url: "/me/achievements", cookies })).json();
      expect(list[0]).toMatchObject({ status: "EVIDENCE_ATTACHED", evidenceIds: [evidence.id] });
    });

    it("unlinking the last evidence moves it back to UNVERIFIED", async () => {
      const { cookies, achievement, evidence } = await achievementWithEvidence();
      const second = (await upload(app, cookies)).json();
      await link(cookies, evidence.id, achievement.id);
      await link(cookies, second.id, achievement.id);

      const unlink = (evidenceId: string) =>
        app.inject({
          method: "DELETE",
          url: `/me/evidence/${evidenceId}/links?entityType=achievement&entityId=${achievement.id}`,
          cookies,
        });
      expect((await unlink(evidence.id)).json().status).toBe("EVIDENCE_ATTACHED");
      expect((await unlink(second.id)).json().status).toBe("UNVERIFIED");
      expect((await unlink(second.id)).statusCode).toBe(404);
    });

    it("deleting the last linked evidence moves the claim back to UNVERIFIED", async () => {
      const { cookies, achievement, evidence } = await achievementWithEvidence();
      await link(cookies, evidence.id, achievement.id);
      expect(
        (await app.inject({ method: "DELETE", url: `/me/evidence/${evidence.id}`, cookies })).statusCode,
      ).toBe(204);
      const list = (await app.inject({ method: "GET", url: "/me/achievements", cookies })).json();
      expect(list[0]).toMatchObject({ status: "UNVERIFIED", evidenceIds: [] });
      expect(await testPrisma().evidenceBlob.count()).toBe(0);
    });

    it("never downgrades PENDING_ISSUER or VERIFIED through linking", async () => {
      const { cookies, userId, evidence } = await achievementWithEvidence();
      const verified = await testPrisma().achievement.create({
        data: { userId, title: "V", status: "VERIFIED" },
      });
      await link(cookies, evidence.id, verified.id);
      const res = await app.inject({
        method: "DELETE",
        url: `/me/evidence/${evidence.id}/links?entityType=achievement&entityId=${verified.id}`,
        cookies,
      });
      expect(res.json().status).toBe("VERIFIED");
    });

    it("keeps skills.evidence_ids in sync with links", async () => {
      const { cookies, evidence } = await achievementWithEvidence();
      const skill = (
        await app.inject({ method: "POST", url: "/me/skills", cookies, payload: { name: "Go" } })
      ).json();
      await link(cookies, evidence.id, skill.id, "skill");
      const row = await testPrisma().skill.findUniqueOrThrow({ where: { id: skill.id } });
      expect(row.evidenceIds).toEqual([evidence.id]);
    });

    it("refuses to link to another user's claim or evidence", async () => {
      const alice = await achievementWithEvidence();
      const bob = await achievementWithEvidence();
      expect((await link(bob.cookies, bob.evidence.id, alice.achievement.id)).statusCode).toBe(404);
      expect((await link(bob.cookies, alice.evidence.id, bob.achievement.id)).statusCode).toBe(404);
    });
  });
});
