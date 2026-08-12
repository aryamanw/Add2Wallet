import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "add2wallet_session";
const SESSION_VALUE = "authenticated";

function getSecret(): string {
  const secret = process.env.APP_PASSWORD;
  if (!secret) {
    throw new Error("APP_PASSWORD is not set");
  }
  return secret;
}

function sign(value: string): string {
  const hmac = createHmac("sha256", getSecret()).update(value).digest("hex");
  return `${value}.${hmac}`;
}

export function checkPassword(candidate: string): boolean {
  const expectedBuf = Buffer.from(getSecret());
  const candidateBuf = Buffer.from(candidate);
  if (expectedBuf.length !== candidateBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, candidateBuf);
}

export function createSessionCookieValue(): string {
  return sign(SESSION_VALUE);
}

export function verifySessionCookieValue(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const [value, signature] = cookieValue.split(".");
  if (!value || !signature || value !== SESSION_VALUE) return false;

  const expectedSignature = sign(value).split(".")[1];
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(sigBuf, expectedBuf);
}
