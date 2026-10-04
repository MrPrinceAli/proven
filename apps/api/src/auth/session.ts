import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Prisma, PrismaClient } from "@proven/db";
import type { Config } from "../config";

export const SESSION_COOKIE = "proven_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest();

export interface SessionAuth {
  sessionId: string;
  userId: string;
  address: string;
  /** "siwe" for wallet logins, "demo" for demo-mode logins (D-032). */
  via: string;
}

/** Creates a session row (storing only sha256 of the token) and returns the raw token for the cookie. */
export async function createSession(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string,
  address: string,
  via: "siwe" | "demo" = "siwe",
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { userId, address, tokenHash: sha256(token), expiresAt, via } });
  return { token, expiresAt };
}

export function setSessionCookie(reply: FastifyReply, config: Config, token: string, expiresAt: Date) {
  reply.setCookie(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    signed: true,
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply, config: Config) {
  reply.clearCookie(SESSION_COOKIE, {
    path: "/",
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
  });
}

/** Resolves the session from the signed cookie, or null when absent, tampered or expired. */
export async function readSession(request: FastifyRequest): Promise<SessionAuth | null> {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return null;

  const session = await request.server.prisma.session.findUnique({
    where: { tokenHash: sha256(unsigned.value) },
  });
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;
  return { sessionId: session.id, userId: session.userId, address: session.address, via: session.via };
}
