import { createHash, pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";

export function bytesToHex(bytes: Uint8Array | Buffer) {
  return Buffer.from(bytes).toString("hex");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashPassword(password: string, salt: Buffer | Uint8Array) {
  return pbkdf2Sync(password, Buffer.from(salt), 100_000, 32, "sha256").toString("hex");
}

export function createSalt() {
  return randomBytes(16);
}

export function createSessionToken() {
  return `${randomUUID()}${randomUUID()}`;
}

export function isStrongPassword(password: string) {
  return password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password);
}
