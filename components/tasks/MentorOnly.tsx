"use client";

import type { ReactNode } from "react";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { BackLink } from "@/components/ui/TextLink";

/** Viewers share the /mentor area but get a read-only notice instead of create/edit screens. */
export function MentorOnly({ children }: { children: ReactNode }) {
  const profile = useSignedInProfile();
  if (profile.role === "mentor") return children;
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold tracking-tight">Read-only access</h1>
      <p className="opacity-80">Only mentors can create or edit tasks.</p>
      <BackLink href="/mentor/tasks">Tasks</BackLink>
    </section>
  );
}
