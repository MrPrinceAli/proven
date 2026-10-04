import { PrismaClient } from "@prisma/client";

/** Creates a client; pass a URL to target another database (e.g. tests). */
export function createPrismaClient(datasourceUrl?: string): PrismaClient {
  return new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);
}

const globalForPrisma = globalThis as unknown as { __provenPrisma?: PrismaClient };

/**
 * One client per process/function instance. Serverless instances are reused between
 * requests, so this avoids opening a new connection pool for every invocation.
 */
export function getPrisma(): PrismaClient {
  globalForPrisma.__provenPrisma ??= createPrismaClient();
  return globalForPrisma.__provenPrisma;
}
