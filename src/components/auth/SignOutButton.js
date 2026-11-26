"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignOut() {
    setIsLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isLoading}
      className="h-10 rounded-full bg-[#050505] dark:bg-white px-5 text-sm font-medium text-white dark:text-[#111111] hover:bg-[#1f1f1f] dark:hover:bg-neutral-200 transition disabled:opacity-60 cursor-pointer"
    >
      {isLoading ? "Signing out..." : "Sign out"}
    </button>
  );
}
