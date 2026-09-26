"use client";

import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { ProfileCard } from "@/components/ProfileCard";

export default function StudentHomePage() {
  return <ProfileCard profile={useSignedInProfile()} title="Your dashboard" />;
}
