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

export async function isIssuer(request: FastifyRequest, address: string): Promise<boolean> {
  // On-chain IssuerRegistry.isActive is added to this check in W4.
  const issuer = await request.server.prisma.issuer.findFirst({ where: { address, verified: true } });
  return issuer !== null;
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
