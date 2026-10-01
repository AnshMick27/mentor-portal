"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api/client";
import { removalResponseSchema } from "@/lib/students/list";

type Step = "idle" | "confirm" | "working";

/** Presentational part (render-tested): Remove with an inline confirm step, or Restore for removed students. */
export function RemoveStudentControls({
  name,
  removed,
  step,
  error,
  onStart,
  onCancel,
  onConfirm,
}: {
  name: string;
  removed: boolean;
  step: Step;
  error?: string;
  onStart: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const errorLine = error && (
    <p role="alert" className="text-sm text-red-700 dark:text-red-300">
      {error}
    </p>
  );
  if (removed) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button variant="secondary" size="sm" onClick={onConfirm} busy={step === "working"} busyLabel="Restoring…">
          Restore access
        </Button>
        {errorLine}
      </div>
    );
  }
  if (step === "idle") {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button variant="secondary" size="sm" onClick={onStart}>
          Remove from portal
        </Button>
        {errorLine}
      </div>
    );
  }
  return (
    <div role="group" aria-label={`Remove ${name}`} className="flex flex-col gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
      <p>
        Remove <span className="font-semibold">{name}</span> from the portal? They lose access straight away and drop out
        of the dashboards and export. Their work is kept, and you can restore them later.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" size="sm" onClick={onConfirm} busy={step === "working"} busyLabel="Removing…">
          Yes, remove
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={step === "working"}>
          Cancel
        </Button>
      </div>
      {errorLine}
    </div>
  );
}

/** Mentor-only Remove/Restore for one student; calls `onChanged` after the server confirms. */
export function RemoveStudentButton({
  uid,
  name,
  removed,
  onChanged,
}: {
  uid: string;
  name: string;
  removed: boolean;
  onChanged: () => void;
}) {
  const { getIdToken } = useAuth();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string>();

  async function run() {
    setStep("working");
    setError(undefined);
    const action = removed ? "restore" : "remove";
    const result = await apiFetch(getIdToken, `/api/students/${encodeURIComponent(uid)}/${action}`, { method: "POST" });
    if (result.ok && removalResponseSchema.safeParse(result.data).success) {
      setStep("idle");
      onChanged();
      return;
    }
    setError(result.ok ? "Something went wrong. Please reload the page." : result.message);
    setStep(removed ? "idle" : "confirm");
  }

  return (
    <RemoveStudentControls
      name={name}
      removed={removed}
      step={step}
      error={error}
      onStart={() => setStep("confirm")}
      onCancel={() => {
        setStep("idle");
        setError(undefined);
      }}
      onConfirm={() => void run()}
    />
  );
}
