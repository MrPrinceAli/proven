// Drives the API like a wallet would (SIWE signed with test keys), to set up browser tests.
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { E2E_ORIGIN, ISSUER_KEY } from "./env";

const json = { "content-type": "application/json" };

export interface Session {
  account: PrivateKeyAccount;
  call<T = unknown>(path: string, body?: unknown, method?: string): Promise<{ status: number; body: T }>;
  upload(
    file: Buffer,
    filename: string,
    fields?: Record<string, string>,
  ): Promise<{ id: string; sha256: string }>;
}

export async function login(
  account: PrivateKeyAccount = privateKeyToAccount(generatePrivateKey()),
): Promise<Session> {
  const nonceRes = await fetch(`${E2E_ORIGIN}/api/auth/siwe/nonce`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ address: account.address, chainId: 31337 }),
  });
  const { nonce } = (await nonceRes.json()) as { nonce: string };
  const message = createSiweMessage({
    domain: new URL(E2E_ORIGIN).host,
    address: account.address,
    uri: E2E_ORIGIN,
    version: "1",
    chainId: 31337,
    nonce,
    issuedAt: new Date(),
  });
  const verify = await fetch(`${E2E_ORIGIN}/api/auth/siwe/verify`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ message, signature: await account.signMessage({ message }) }),
  });
  if (!verify.ok) throw new Error(`login failed: ${verify.status} ${await verify.text()}`);
  const cookie = verify.headers.getSetCookie()[0]!.split(";")[0]!;

  return {
    account,
    async call<T>(path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
      const res = await fetch(`${E2E_ORIGIN}/api${path}`, {
        method,
        headers: { ...json, cookie },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, body: (await res.json().catch(() => null)) as T };
    },
    async upload(file, filename, fields = {}) {
      const form = new FormData();
      for (const [k, v] of Object.entries(fields)) form.append(k, v);
      form.append("file", new Blob([new Uint8Array(file)], { type: "application/pdf" }), filename);
      const res = await fetch(`${E2E_ORIGIN}/api/me/evidence`, {
        method: "POST",
        headers: { cookie },
        body: form,
      });
      return (await res.json()) as { id: string; sha256: string };
    },
  };
}

export const loginIssuer = () => login(privateKeyToAccount(ISSUER_KEY));

/** A user whose achievement went through request → issuer approval. Returns the credential URN. */
export async function issueCredential(slug: string) {
  const user = await login();
  await user.call(
    "/me/profile",
    { slug, headline: "Smart Contract Engineer", visibility: "public" },
    "PATCH",
  );
  const achievement = (
    await user.call<{ id: string }>("/me/achievements", { title: "XYZ Hackathon 2026 — Winner", year: 2026 })
  ).body;
  const evidence = await user.upload(Buffer.from("%PDF-1.4\nE2E certificate\n%%EOF\n"), "sertifikat.pdf", {
    type: "hackathon",
  });
  await user.call(`/me/evidence/${evidence.id}/links`, {
    entityType: "achievement",
    entityId: achievement.id,
  });
  const issuers = (await user.call<{ id: string; name: string }[]>("/issuers")).body;
  const issuerId = issuers.find((i) => i.name === "XYZ Community")!.id;
  const request = (
    await user.call<{ id: string }>("/me/verification-requests", {
      entityType: "achievement",
      entityId: achievement.id,
      issuerId,
      evidenceIds: [evidence.id],
    })
  ).body;
  const issuer = await loginIssuer();
  const approved = await issuer.call<{ credentialId: string; txHash: string }>(
    `/issuer/verification-requests/${request.id}/approve`,
    {},
  );
  if (approved.status !== 200) throw new Error(`approve failed: ${JSON.stringify(approved.body)}`);
  return { user, issuer, achievementId: achievement.id, ...approved.body };
}
