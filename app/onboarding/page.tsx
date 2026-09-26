"use client";

import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { OnboardingForm } from "@/components/OnboardingForm";

export default function OnboardingPage() {
  const profile = useSignedInProfile();
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Complete your profile</h1>
        <p className="text-base opacity-80">
          Hi {profile.name}, enter your roll number and branch once to get started. Ask a mentor if you need to change
          them later.
        </p>
      </div>
      <OnboardingForm />
    </section>
  );
}
