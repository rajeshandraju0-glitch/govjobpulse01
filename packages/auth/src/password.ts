// Section 10: "JWT hardening" implies real auth exists; this is the
// password half of it. Node's built-in crypto.scrypt rather than
// bcrypt/argon2 — scrypt is a legitimate, well-regarded KDF, and using
// the built-in avoids any native-module compilation (bcrypt needs
// node-gyp) that could behave differently across deployment
// environments. No third-party password-hashing dependency at all.

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false; // malformed stored hash — fail closed, not throw

  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const storedKey = Buffer.from(keyHex, "hex");

  // timingSafeEqual requires equal-length buffers; a length mismatch
  // means the password is wrong, but we still need to avoid an early
  // exit that would leak timing information about *why* it's wrong.
  if (derivedKey.length !== storedKey.length) return false;
  return timingSafeEqual(derivedKey, storedKey);
}
