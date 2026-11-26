import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRecordById } from "@/lib/supabase/users";
import ProfileSetupForm from "@/components/profile/ProfileSetupForm";

export const metadata = {
  title: "Profile Setup",
  description: "Set up your profile photo and personal details.",
};

async function ProfileSetupContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { user: dbUser } = await getUserRecordById(user.id);
  const meta = user.user_metadata || {};

  const initialProfile = {
    username: dbUser?.username ?? meta.username ?? "",
    fullName: dbUser?.full_name ?? meta.full_name ?? "",
    phone: dbUser?.phone ?? meta.phone ?? "",
    about: dbUser?.about ?? meta.about ?? "",
    dateOfBirth: dbUser?.date_of_birth ?? meta.date_of_birth ?? "",
    avatarUrl: dbUser?.avatar_url ?? meta.avatar_url ?? "",
    profileCompleted: Boolean(
      dbUser?.profile_completed ?? meta.profile_completed
    ),
  };

  return <ProfileSetupForm initialProfile={initialProfile} />;
}

export default function ProfileSetupPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen w-full bg-white dark:bg-[#0b141a] flex items-center justify-center text-sm text-neutral-500">
          Loading profile setup...
        </main>
      }
    >
      <ProfileSetupContent />
    </Suspense>
  );
}
