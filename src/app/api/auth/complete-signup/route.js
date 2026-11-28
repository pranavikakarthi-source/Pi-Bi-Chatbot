import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { syncUserRecord } from "@/lib/supabase/users";
import {
  VERIFIED_COOKIE_NAME,
  verifySignedSessionToken,
} from "@/lib/auth/otp";
import { completeSignupSchema, getFirstZodError } from "@/lib/validation/schemas";

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = completeSignupSchema.safeParse({
      password: body?.password,
      confirmPassword: body?.confirmPassword,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: getFirstZodError(parsed, "Invalid password details.") },
        { status: 400 }
      );
    }

    const { password } = parsed.data;

    const cookieStore = await cookies();
    const verifiedToken = cookieStore.get(VERIFIED_COOKIE_NAME)?.value;
    const payload = verifySignedSessionToken(verifiedToken);

    if (!payload?.verified || !payload?.email) {
      return NextResponse.json(
        { error: "Verification expired. Please verify your email OTP again." },
        { status: 401 }
      );
    }

    const adminSupabase = createAdminClient();
    const { data: createdData, error: createError } =
      await adminSupabase.auth.admin.createUser({
        email: payload.email,
        password,
        email_confirm: true,
        user_metadata: { signup_completed: true },
      });

    if (createError) {
      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      );
    }

    const serverSupabase = await createClient();
    const { error: signInError } = await serverSupabase.auth.signInWithPassword({
      email: payload.email,
      password,
    });

    if (signInError) {
      return NextResponse.json(
        { error: signInError.message },
        { status: 500 }
      );
    }

    const syncResult = await syncUserRecord(createdData.user, {
      markLogin: true,
      markOnline: true,
    });

    const response = NextResponse.json({
      ok: true,
      user: {
        id: createdData.user?.id,
        email: createdData.user?.email,
      },
      dbSynced: syncResult.synced,
      missingTable: syncResult.missingTable,
    });
    response.cookies.delete(VERIFIED_COOKIE_NAME);

    return response;
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unable to complete sign up right now.",
      },
      { status: 500 }
    );
  }
}
