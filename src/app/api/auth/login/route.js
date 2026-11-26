import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncUserRecord } from "@/lib/supabase/users";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const syncResult = await syncUserRecord(data.user, {
      markLogin: true,
      markOnline: true,
    });

    const profileCompleted = Boolean(
      syncResult.user?.profile_completed ??
        data.user.user_metadata?.profile_completed
    );

    return NextResponse.json({
      ok: true,
      redirectTo: profileCompleted ? "/" : "/profile-setup",
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      dbSynced: syncResult.synced,
      missingTable: syncResult.missingTable,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Unable to login right now.",
      },
      { status: 500 }
    );
  }
}
