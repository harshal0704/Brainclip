import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ENCRYPTION_PREFIX = "enc:v1";

const getKey = () => {
  const secret = process.env.ENCRYPTION_KEY;

  if (!secret) {
    return null;
  }

  return createHash("sha256").update(secret).digest();
};

export const encryptSecret = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const key = getKey();

  if (!key) {
    return value;
  }

  if (value.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return value;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
};

export const decryptSecret = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  if (!value.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return value;
  }

  const key = getKey();

  if (!key) {
    return value;
  }

  const [, ivBase64, tagBase64, payloadBase64] = value.split(":");

  if (!ivBase64 || !tagBase64 || !payloadBase64) {
    return value;
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivBase64, "base64"));
    decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payloadBase64, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return value;
  }
};
