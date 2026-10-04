import type { FastifyRequest } from "fastify";
import { problem } from "../problem";
import { readSession, type SessionAuth } from "./session";

declare module "fastify" {
  interface FastifyRequest {
    auth?: SessionAuth;
  }
}

/** Every protected route uses one of these as preHandler (deny-by-default). */
export async function requireUser(request: FastifyRequest): Promise<void> {
  const session = await readSession(request);
  if (!session) throw problem(401, "unauthorized", "Login required");
  request.auth = session;
  if (session.via === "demo") await guardDemoIssuer(request);
}

/**
 * The demo issuer session acts as the real relay issuer's account (D-032), so anonymous visitors
 * may only review/approve demo requests there: no profile edits, uploads, AI or data export (D-035).
 */
async function guardDemoIssuer(request: FastifyRequest): Promise<void> {
  const user = await request.server.prisma.user.findUnique({
    where: { id: request.auth!.userId },
    select: { authProvider: true },
  });
  if (user?.authProvider === "demo") return; // the visitor's own sandbox
  const url = request.routeOptions.url ?? request.url;
  const readOnly = request.method === "GET" && url !== "/me/data-export";
  if (url.startsWith("/issuer/") || url === "/auth/logout" || readOnly) return;
  throw problem(403, "forbidden", "Mode demo issuer hanya bisa meninjau dan memproses permintaan verifikasi");
}

/**
 * Issuer = verified row in `issuers` AND active in IssuerRegistry on-chain (§W4).
 * Fails closed: no chain configured or an RPC error means "not an issuer".
 */
export async function isIssuer(request: FastifyRequest, address: string): Promise<boolean> {
  const issuer = await request.server.prisma.issuer.findFirst({ where: { address, verified: true } });
  if (!issuer || !request.server.chain) return false;
  try {
    return await request.server.chain.isIssuerActive(address as `0x${string}`);
  } catch {
    return false;
  }
}

export function isAdmin(request: FastifyRequest, address: string): boolean {
  return request.server.config.adminAddresses.includes(address);
}

export async function requireIssuer(request: FastifyRequest): Promise<void> {
  await requireUser(request);
  if (!(await isIssuer(request, request.auth!.address)))
    throw problem(403, "forbidden", "Issuer role required");
}

export async function requireAdmin(request: FastifyRequest): Promise<void> {
  await requireUser(request);
  // A demo login never grants admin, even when the issuer address is an admin (D-035).
  if (request.auth!.via === "demo" || !isAdmin(request, request.auth!.address))
    throw problem(403, "forbidden", "Admin role required");
}
