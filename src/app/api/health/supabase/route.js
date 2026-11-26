import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { url, anonKey } = getSupabaseConfig();
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims();

    if (claimsError) {
      return Response.json(
        { ok: false, connected: false, error: claimsError.message },
        { status: 500 }
      );
    }

    const healthRes = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      cache: "no-store",
    });

    if (!healthRes.ok) {
      return Response.json(
        {
          ok: false,
          connected: false,
          status: healthRes.status,
          error: "Supabase health check failed",
        },
        { status: 502 }
      );
    }

    return Response.json({
      ok: true,
      connected: true,
      authenticated: Boolean(claimsData?.claims),
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        connected: false,
        error: err instanceof Error ? err.message : "Unknown Supabase error",
      },
      { status: 500 }
    );
  }
}
