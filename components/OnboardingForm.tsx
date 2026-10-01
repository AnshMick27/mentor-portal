"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, inputClasses } from "@/components/ui/Field";
import { Note } from "@/components/ui/Note";
import { apiFetch } from "@/lib/api/client";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { BRANCHES } from "@/lib/validation/user";

type FieldErrors = { rollNo?: string; branch?: string };

/** Roll number + branch. On success it refreshes the profile; the route guard then moves the student to /student. */
export function OnboardingForm() {
  const { getIdToken, refreshProfile } = useAuth();
  const [rollNo, setRollNo] = useState("");
  const [branch, setBranch] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = onboardingSchema.safeParse({ rollNo, branch });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error.issues));
      setError(null);
      return;
    }

    setFieldErrors({});
    setError(null);
    setSaving(true);
    const result = await apiFetch(getIdToken, "/api/onboarding", { method: "POST", body: parsed.data });
    if (result.ok) await refreshProfile();
    else setError(result.message);
    setSaving(false);
  }

  return (
    <OnboardingFields
      rollNo={rollNo}
      branch={branch}
      fieldErrors={fieldErrors}
      error={error}
      saving={saving}
      onRollNo={setRollNo}
      onBranch={setBranch}
      onSubmit={(event) => void handleSubmit(event)}
    />
  );
}

/** Each message goes under the field it is about (UX-28); the first one per field wins. */
export function fieldErrorsFrom(issues: readonly { path: readonly PropertyKey[]; message: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if ((key === "rollNo" || key === "branch") && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

/** Presentational part (render-tested). Server errors (e.g. roll number already used) stay a form-level note. */
export function OnboardingFields({
  rollNo,
  branch,
  fieldErrors,
  error,
  saving,
  onRollNo,
  onBranch,
  onSubmit,
}: {
  rollNo: string;
  branch: string;
  fieldErrors: FieldErrors;
  error: string | null;
  saving: boolean;
  onRollNo: (value: string) => void;
  onBranch: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label="Roll number" hint="Your college roll number." error={fieldErrors.rollNo}>
        {(control) => (
          <input
            {...control}
            name="rollNo"
            value={rollNo}
            onChange={(event) => onRollNo(event.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={15}
            placeholder="e.g. 0827CS221001"
            className={inputClasses}
            required
          />
        )}
      </Field>
      <Field label="Branch" error={fieldErrors.branch}>
        {(control) => (
          <select {...control} name="branch" value={branch} onChange={(event) => onBranch(event.target.value)} className={inputClasses} required>
            <option value="" disabled>
              Choose your branch
            </option>
            {BRANCHES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        )}
      </Field>
      {error && <Note tone="danger">{error}</Note>}
      <Button type="submit" busy={saving} busyLabel="Saving…">
        Continue
      </Button>
    </form>
  );
}
