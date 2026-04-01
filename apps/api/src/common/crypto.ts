import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, hashedPassword: string | null): Promise<boolean> {
  if (!hashedPassword) {
    return false;
  }

  const [algorithm, salt, expectedHash] = hashedPassword.split("$");

  if (algorithm !== "scrypt" || !salt || !expectedHash) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (expectedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, derivedKey);
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
