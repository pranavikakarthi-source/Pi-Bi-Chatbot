import crypto from "node:crypto";

export const OTP_COOKIE_NAME = "signup_otp_session";
export const VERIFIED_COOKIE_NAME = "signup_verified_session";
export const OTP_EXPIRY_MS = 10 * 60 * 1000;
export const VERIFIED_EXPIRY_MS = 15 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;

function getSigningSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable for OTP signing."
    );
  }
  return secret;
}

export function generateOtpCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtpCode(email, otp) {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(`${email.toLowerCase()}:${otp}`)
    .digest("hex");
}

export function signSessionPayload(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const signature = crypto
    .createHmac("sha256", getSigningSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifySignedSessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );
    if (!parsed?.expiresAt || Date.now() > parsed.expiresAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function timingSafeHexEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function getAuthCookieOptions(maxAgeSeconds, request) {
  const forwardedProto = request?.headers?.get("x-forwarded-proto");
  const isHttps =
    forwardedProto === "https" || request?.nextUrl?.protocol === "https:";

  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
