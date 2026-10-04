import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export interface Sealed {
  ciphertext: Buffer;
  /** 12-byte random IV, base64. */
  iv: string;
  /** 16-byte GCM auth tag, base64. */
  tag: string;
}

export const sha256 = (data: Buffer) => createHash("sha256").update(data).digest();

/** AES-256-GCM with a fresh 12-byte IV per file. */
export function encrypt(key: Buffer, plaintext: Buffer): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

/** Throws when the ciphertext, IV or tag was altered (GCM authentication). */
export function decrypt(key: Buffer, sealed: Sealed): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]);
}
