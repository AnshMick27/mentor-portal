"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api/client";
import { approvalResponseSchema } from "@/lib/students/list";

/** Presentational part (render-tested): the Approve button and its error line. */
export function ApproveStudentControls({
  name,
  working,
  error,
  onApprove,
}: {
  name: string;
  working: boolean;
  error?: string;
  onApprove: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" onClick={onApprove} busy={working} busyLabel="Approving…" aria-label={`Approve ${name}`}>
        Approve
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

/** Mentor-only: let a waiting student in (T48); calls `onChanged` after the server confirms. */
export function ApproveStudentButton({ uid, name, onChanged }: { uid: string; name: string; onChanged: () => void }) {
  const { getIdToken } = useAuth();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string>();

  async function approve() {
    setWorking(true);
    setError(undefined);
    const result = await apiFetch(getIdToken, `/api/students/${encodeURIComponent(uid)}/approve`, { method: "POST" });
    setWorking(false);
    if (result.ok && approvalResponseSchema.safeParse(result.data).success) {
      onChanged();
      return;
    }
    setError(result.ok ? "Something went wrong. Please reload the page." : result.message);
  }

  return <ApproveStudentControls name={name} working={working} error={error} onApprove={() => void approve()} />;
}
