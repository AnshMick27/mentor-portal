"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Note } from "@/components/ui/Note";
import { Section } from "@/components/ui/Section";
import { apiFetch } from "@/lib/api/client";

type Step = "idle" | "confirm" | "working";

/** Presentational part (render-tested): a Delete button, then an inline confirm that names the task. */
export function DeleteTaskControls({
  title,
  hasSubmissions,
  step,
  error,
  onStart,
  onCancel,
  onConfirm,
}: {
  title: string;
  hasSubmissions: boolean;
  step: Step;
  error?: string;
  onStart: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Section title="Delete task">
      {step === "idle" ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted">To only hide it from students, set it to Draft above instead.</p>
          <Button variant="secondary" size="sm" onClick={onStart}>
            Delete task
          </Button>
        </div>
      ) : (
        <div
          role="group"
          aria-label={`Delete ${title}`}
          className="flex flex-col gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
        >
          <p>
            Delete <span className="font-semibold break-words">{title}</span>? Students will no longer see it.
            {hasSubmissions
              ? " Their attempts on it stay in their history but stop counting towards their stats."
              : " Nobody has submitted to it yet."}{" "}
            This can&apos;t be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={onConfirm} busy={step === "working"} busyLabel="Deleting…">
              Yes, delete
            </Button>
            <Button variant="secondary" size="sm" onClick={onCancel} disabled={step === "working"}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && <Note tone="danger">{error}</Note>}
    </Section>
  );
}

/** Mentor-only delete for one task (T37); goes back to the list, which confirms "Task deleted.". */
export function DeleteTask({ taskId, title, hasSubmissions }: { taskId: string; title: string; hasSubmissions: boolean }) {
  const { getIdToken } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string>();

  async function run() {
    setStep("working");
    setError(undefined);
    const result = await apiFetch(getIdToken, `/api/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
    if (result.ok) return router.push("/mentor/tasks?deleted=1");
    setError(result.message);
    setStep("confirm");
  }

  return (
    <DeleteTaskControls
      title={title}
      hasSubmissions={hasSubmissions}
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
