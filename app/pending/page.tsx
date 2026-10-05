"use client";

import { useState } from "react";
import { useAuth, useSignedInProfile } from "@/components/auth/AuthProvider";
import { PendingApproval } from "@/components/PendingApproval";

/** A new student waits here until a mentor approves them (T48, SPEC.md §8.10). The guard moves them on once approved. */
export default function PendingPage() {
  const profile = useSignedInProfile();
  const { refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  async function checkAgain() {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
    setChecked(true); // still here = still waiting; once approved the guard has already sent them to /student
  }

  return <PendingApproval name={profile.name} checking={checking} checked={checked} onCheck={() => void checkAgain()} />;
}
