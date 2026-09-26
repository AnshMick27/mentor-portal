"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useSignedInProfile } from "@/components/auth/AuthProvider";

/** Viewers share the /mentor area but get a read-only notice instead of create/edit screens. */
export function MentorOnly({ children }: { children: ReactNode }) {
  const profile = useSignedInProfile();
  if (profile.role === "mentor") return children;
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold tracking-tight">Read-only access</h1>
      <p className="opacity-80">Only mentors can create or edit tasks.</p>
      <Link href="/mentor/tasks" className="self-start font-medium text-blue-700 underline dark:text-blue-300">
        Back to tasks
      </Link>
    </section>
  );
}
