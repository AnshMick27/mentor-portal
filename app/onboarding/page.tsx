"use client";

import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { OnboardingForm } from "@/components/OnboardingForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default function OnboardingPage() {
  const profile = useSignedInProfile();
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6">
      <PageHeader
        title="Complete your profile"
        subtitle={`Hi ${profile.name}, enter your roll number and branch once to get started. Ask a mentor if you need to change them later.`}
      />
      <OnboardingForm />
    </section>
  );
}
