"use client";

import Link from "next/link";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { ProfileCard } from "@/components/ProfileCard";

export default function MentorHomePage() {
  const profile = useSignedInProfile();
  return (
    <>
      <ProfileCard profile={profile} title="Mentor dashboard" />
      <Link
        href="/mentor/tasks"
        className="inline-flex min-h-11 items-center justify-center self-start rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        {profile.role === "mentor" ? "Manage tasks" : "View tasks"}
      </Link>
    </>
  );
}
