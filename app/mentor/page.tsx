"use client";

import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { ProfileCard } from "@/components/ProfileCard";

export default function MentorHomePage() {
  return <ProfileCard profile={useSignedInProfile()} title="Mentor dashboard" />;
}
