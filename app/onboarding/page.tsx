"use client";

import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { ProfileCard } from "@/components/ProfileCard";

/** Placeholder: T8 replaces this with the roll number and branch form. */
export default function OnboardingPage() {
  return <ProfileCard profile={useSignedInProfile()} title="Complete your profile" />;
}
