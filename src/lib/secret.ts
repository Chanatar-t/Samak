// Encrypts the Gmail app password at rest (AES-256-GCM, key derived from AUTH_SECRET).
// Tests: node --test src/lib/secret.test.ts
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const key = (secret = process.env.AUTH_SECRET) => {
  if (!secret) throw new Error("AUTH_SECRET not set — run npm run setup");
  return createHash("sha256").update(`gmail-app-password:${secret}`).digest();
};

export function encrypt(plain: string, secret?: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv, c.getAuthTag(), body].map((x) => (typeof x === "string" ? x : x.toString("base64"))).join(":");
}

/** Throws if AUTH_SECRET changed since it was saved (user must reconnect Gmail). */
export function decrypt(stored: string, secret?: string) {
  const [v, iv, tag, body] = stored.split(":");
  if (v !== "v1") throw new Error("unknown secret format");
  const d = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(body, "base64")), d.final()]).toString("utf8");
}
