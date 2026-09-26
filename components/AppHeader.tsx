"use client";

import Link from "next/link";
import type { UserProfile } from "@/lib/validation/user";
import { useAuth } from "./auth/AuthProvider";

export function AppHeader({ profile }: { profile: UserProfile }) {
  const { signOut } = useAuth();
  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="truncate font-semibold">
          CDC Mentor Portal
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden truncate text-sm opacity-70 sm:inline">{profile.name}</span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="min-h-11 shrink-0 rounded-lg border border-black/15 px-4 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/20 dark:hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
