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
  if (!isAdmin(request, request.auth!.address)) throw problem(403, "forbidden", "Admin role required");
}
