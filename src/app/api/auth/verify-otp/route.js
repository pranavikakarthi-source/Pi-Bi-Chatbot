import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAuthCookieOptions,
  hashOtpCode,
  MAX_OTP_ATTEMPTS,
  OTP_COOKIE_NAME,
  signSessionPayload,
  timingSafeHexEqual,
  VERIFIED_COOKIE_NAME,
  VERIFIED_EXPIRY_MS,
  verifySignedSessionToken,
} from "@/lib/auth/otp";

export async function POST(request) {
  try {
    const body = await request.json();
    const normalizedEmail = String(body?.email || "")
      .trim()
      .toLowerCase();
    const otp = String(body?.otp || "").trim();

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: "Please enter a valid 6-digit OTP." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(OTP_COOKIE_NAME)?.value;
    const payload = verifySignedSessionToken(sessionToken);

    if (!payload || payload.email !== normalizedEmail) {
      return NextResponse.json(
        { error: "OTP session expired or invalid. Please request a new OTP." },
        { status: 400 }
      );
    }

    const expectedHash = hashOtpCode(normalizedEmail, otp);
    if (!timingSafeHexEqual(expectedHash, payload.otpHash)) {
      const nextAttempts = (payload.attempts || 0) + 1;

      if (nextAttempts >= MAX_OTP_ATTEMPTS) {
        const exhaustedResponse = NextResponse.json(
          { error: "Too many invalid attempts. Please request a new OTP." },
          { status: 429 }
        );
        exhaustedResponse.cookies.delete(OTP_COOKIE_NAME);
        return exhaustedResponse;
      }

      const updatedToken = signSessionPayload({
        ...payload,
        attempts: nextAttempts,
      });

      const remainingSeconds = Math.max(
        1,
        Math.floor((payload.expiresAt - Date.now()) / 1000)
      );

      const errorResponse = NextResponse.json(
        { error: "Invalid OTP. Please check the code and try again." },
        { status: 400 }
      );
      errorResponse.cookies.set(
        OTP_COOKIE_NAME,
        updatedToken,
        getAuthCookieOptions(remainingSeconds, request)
      );
      return errorResponse;
    }

    const verifiedToken = signSessionPayload({
      email: normalizedEmail,
      verified: true,
      expiresAt: Date.now() + VERIFIED_EXPIRY_MS,
    });

    const response = NextResponse.json({
      ok: true,
      message: "Email verified successfully.",
    });

    response.cookies.delete(OTP_COOKIE_NAME);
    response.cookies.set(
      VERIFIED_COOKIE_NAME,
      verifiedToken,
      getAuthCookieOptions(Math.floor(VERIFIED_EXPIRY_MS / 1000), request)
    );

    return response;
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Unable to verify OTP right now.",
      },
      { status: 500 }
    );
  }
}
