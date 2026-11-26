import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensurePublicBucket } from "@/lib/supabase/storage";
import { getUserRecordById, syncUserRecord } from "@/lib/supabase/users";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function isValidUsername(value) {
  return /^[a-zA-Z0-9_.]{3,30}$/.test(value);
}

function isValidPhone(value) {
  const digits = value.replace(/\D/g, "");
  return /^[+\d][\d\s()-]{6,20}$/.test(value) && digits.length >= 7 && digits.length <= 15;
}

function isValidDob(value) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const currentYear = new Date().getFullYear();

  if (year < 1900 || year > currentYear || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user: dbUser } = await getUserRecordById(user.id);
    const meta = user.user_metadata || {};

    return NextResponse.json({
      ok: true,
      profile: {
        email: user.email,
        username: dbUser?.username ?? meta.username ?? "",
        fullName: dbUser?.full_name ?? meta.full_name ?? "",
        phone: dbUser?.phone ?? meta.phone ?? "",
        about: dbUser?.about ?? meta.about ?? "",
        dateOfBirth: dbUser?.date_of_birth ?? meta.date_of_birth ?? "",
        avatarUrl: dbUser?.avatar_url ?? meta.avatar_url ?? "",
        profileCompleted: Boolean(
          dbUser?.profile_completed ?? meta.profile_completed
        ),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Unable to load profile.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const username = String(formData.get("username") || "").trim();
    const fullName = String(formData.get("fullName") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const about = String(formData.get("about") || "").trim();
    const dateOfBirth = String(formData.get("dateOfBirth") || "").trim();
    const avatarFile = formData.get("avatar");

    if (!isValidUsername(username)) {
      return NextResponse.json(
        {
          error:
            "Username must be 3–30 characters using letters, numbers, underscores, or dots.",
        },
        { status: 400 }
      );
    }

    if (fullName.length < 2) {
      return NextResponse.json(
        { error: "Please enter your name (at least 2 characters)." },
        { status: 400 }
      );
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: "Please enter a valid phone number." },
        { status: 400 }
      );
    }

    if (about.length > 160) {
      return NextResponse.json(
        { error: "About must be 160 characters or fewer." },
        { status: 400 }
      );
    }

    if (!isValidDob(dateOfBirth)) {
      return NextResponse.json(
        { error: "Please enter a valid Date of Birth in dd-mm-yyyy format." },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();
    let avatarUrl = user.user_metadata?.avatar_url ?? null;

    if (avatarFile && typeof avatarFile === "object" && avatarFile.size > 0) {
      if (!ALLOWED_IMAGE_TYPES.has(avatarFile.type)) {
        return NextResponse.json(
          { error: "Profile image must be JPG, PNG, WebP, or GIF." },
          { status: 400 }
        );
      }

      if (avatarFile.size > MAX_AVATAR_BYTES) {
        return NextResponse.json(
          { error: "Profile image must be 5 MB or smaller." },
          { status: 400 }
        );
      }

      await ensurePublicBucket(adminSupabase, AVATAR_BUCKET, {
        fileSizeLimit: MAX_AVATAR_BYTES,
        allowedMimeTypes: Array.from(ALLOWED_IMAGE_TYPES),
      });

      const ext = avatarFile.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
      const filePath = `${user.id}/avatar-${Date.now()}.${ext}`;
      const buffer = Buffer.from(await avatarFile.arrayBuffer());

      const { error: uploadError } = await adminSupabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, buffer, {
          contentType: avatarFile.type,
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: uploadError.message || "Failed to upload profile photo." },
          { status: 500 }
        );
      }

      const { data: publicUrlData } = adminSupabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

      avatarUrl = publicUrlData?.publicUrl ?? avatarUrl;
    }

    const updatedMetadata = {
      ...(user.user_metadata || {}),
      username,
      full_name: fullName,
      phone,
      about: about || null,
      date_of_birth: dateOfBirth,
      avatar_url: avatarUrl,
      profile_completed: true,
      signup_completed: true,
    };

    const { data: updatedAuth, error: updateAuthError } =
      await adminSupabase.auth.admin.updateUserById(user.id, {
        user_metadata: updatedMetadata,
      });

    if (updateAuthError) {
      return NextResponse.json(
        { error: updateAuthError.message },
        { status: 500 }
      );
    }

    const syncResult = await syncUserRecord(updatedAuth.user, {
      markOnline: true,
      profile: {
        username,
        full_name: fullName,
        phone,
        about: about || null,
        date_of_birth: dateOfBirth,
        avatar_url: avatarUrl,
        profile_completed: true,
      },
    });

    if (!syncResult.synced && !syncResult.schemaPending && syncResult.error) {
      return NextResponse.json(
        { error: syncResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      profile: {
        username,
        fullName,
        phone,
        about,
        dateOfBirth,
        avatarUrl,
        profileCompleted: true,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to save profile.",
      },
      { status: 500 }
    );
  }
}
