"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/lib/api/client";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { BRANCHES } from "@/lib/validation/user";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-black/20 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/25";

/** Roll number + branch. On success it refreshes the profile; the route guard then moves the student to /student. */
export function OnboardingForm() {
  const { getIdToken, refreshProfile } = useAuth();
  const [rollNo, setRollNo] = useState("");
  const [branch, setBranch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = onboardingSchema.safeParse({ rollNo, branch });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your details.");
      return;
    }

    setError(null);
    setSaving(true);
    const result = await apiFetch(getIdToken, "/api/onboarding", { method: "POST", body: parsed.data });
    if (result.ok) await refreshProfile();
    else setError(result.message);
    setSaving(false);
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-5" noValidate>
      <label className="flex flex-col gap-2">
        <span className="font-medium">Roll number</span>
        <input
          name="rollNo"
          value={rollNo}
          onChange={(event) => setRollNo(event.target.value.toUpperCase())}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={15}
          placeholder="e.g. 0827CS221001"
          className={fieldClass}
          required
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-medium">Branch</span>
        <select name="branch" value={branch} onChange={(event) => setBranch(event.target.value)} className={fieldClass} required>
          <option value="" disabled>
            Choose your branch
          </option>
          {BRANCHES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60"
      >
        {saving ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
