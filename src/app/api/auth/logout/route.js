import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markUserOffline } from "@/lib/supabase/users";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      await markUserOffline(user.id);
    }

    await supabase.auth.signOut();

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Unable to sign out right now.",
      },
      { status: 500 }
    );
  }
}
