"use client";

import type { ReactNode } from "react";
import { useSignedInProfile } from "@/components/auth/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";

/** Viewers share the /mentor area but get a read-only notice instead of create/edit screens. */
export function MentorOnly({ children }: { children: ReactNode }) {
  const profile = useSignedInProfile();
  if (profile.role === "mentor") return children;
  return (
    <>
      <PageHeader title="Read-only access" back={{ href: "/mentor/tasks", label: "Tasks" }} />
      <p>Only mentors can create or edit tasks.</p>
    </>
  );
}
