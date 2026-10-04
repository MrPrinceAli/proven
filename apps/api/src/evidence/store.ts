import type { Prisma, PrismaClient } from "@proven/db";

type Db = PrismaClient | Prisma.TransactionClient;

/** Where evidence ciphertext lives. MVP: Postgres table evidence_blobs (D-004); S3/R2 is roadmap. */
export interface EvidenceStore {
  put(db: Db, ciphertext: Buffer): Promise<string>;
  get(db: Db, storageKey: string): Promise<Buffer | null>;
  delete(db: Db, storageKey: string): Promise<void>;
}

const PREFIX = "pg:";

export const postgresEvidenceStore: EvidenceStore = {
  async put(db, ciphertext) {
    const blob = await db.evidenceBlob.create({ data: { ciphertext } });
    return `${PREFIX}${blob.id}`;
  },
  async get(db, storageKey) {
    if (!storageKey.startsWith(PREFIX)) return null;
    const blob = await db.evidenceBlob.findUnique({ where: { id: storageKey.slice(PREFIX.length) } });
    return blob ? Buffer.from(blob.ciphertext) : null;
  },
  async delete(db, storageKey) {
    if (!storageKey.startsWith(PREFIX)) return;
    await db.evidenceBlob.deleteMany({ where: { id: storageKey.slice(PREFIX.length) } });
  },
};
