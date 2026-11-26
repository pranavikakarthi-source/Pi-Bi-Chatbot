import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSignupOtpEmail } from "@/lib/email/mailer";
import {
  generateOtpCode,
  getAuthCookieOptions,
  hashOtpCode,
  OTP_COOKIE_NAME,
  OTP_EXPIRY_MS,
  signSessionPayload,
} from "@/lib/auth/otp";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function isEmailRegistered(adminSupabase, targetEmail) {
  const { data, error } = await adminSupabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error || !data?.users) {
    return false;
  }

  return data.users.some(
    (user) => user.email?.toLowerCase() === targetEmail
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const normalizedEmail = String(body?.email || "")
      .trim()
      .toLowerCase();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();
    const alreadyExists = await isEmailRegistered(adminSupabase, normalizedEmail);

    if (alreadyExists) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please login instead." },
        { status: 409 }
      );
    }

    const otp = generateOtpCode();
    await sendSignupOtpEmail({ to: normalizedEmail, otp });

    const token = signSessionPayload({
      email: normalizedEmail,
      otpHash: hashOtpCode(normalizedEmail, otp),
      attempts: 0,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
    });

    const response = NextResponse.json({
      ok: true,
      message: "OTP sent to your email.",
    });

    response.cookies.set(
      OTP_COOKIE_NAME,
      token,
      getAuthCookieOptions(Math.floor(OTP_EXPIRY_MS / 1000), request)
    );

    return response;
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to send OTP email. Check your SMTP settings.",
      },
      { status: 500 }
    );
  }
}
