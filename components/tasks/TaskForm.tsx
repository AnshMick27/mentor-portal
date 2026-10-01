"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/Button";
import { Note } from "@/components/ui/Note";
import { apiFetch } from "@/lib/api/client";
import { formToTaskInput, taskToPatch, type TaskFormState } from "@/lib/tasks/taskForm";
import {
  DEFAULT_MAX_ATTEMPTS,
  LANGUAGE_LABEL,
  LANGUAGES,
  TASK_TYPE_LABEL,
  TASK_TYPES,
  taskInputSchema,
  type Language,
} from "@/lib/validation/task";

const inputClass =
  "min-h-11 w-full rounded-lg border border-black/20 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/25 disabled:opacity-60 read-only:opacity-60";
const textareaClass = `${inputClass} py-2 font-mono text-sm`;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-sm opacity-70">{hint}</span>}
    </label>
  );
}

/** In edit mode, `hasSubmissions` locks the type and problem slug (the API refuses those changes too). */
type Props = { initial: TaskFormState } & ({ mode: "new" } | { mode: "edit"; taskId: string; hasSubmissions?: boolean });

const LOCKED_HINT = "Locked: students have already submitted to this task.";

/** Create/edit form for mentors. Validates with the same zod schema as the API before sending. */
export function TaskForm(props: Props) {
  const { getIdToken } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<TaskFormState>(props.initial);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }

  function toggleLanguage(language: Language, checked: boolean) {
    const next = checked ? [...form.languages, language] : form.languages.filter((l) => l !== language);
    update("languages", LANGUAGES.filter((l) => next.includes(l)));
  }

  function updateSample(index: number, key: "input" | "output", value: string) {
    update("sampleTests", form.sampleTests.map((test, i) => (i === index ? { ...test, [key]: value } : test)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.dueAtLocal) return setError("Choose a due date and time.");
    const parsed = taskInputSchema.safeParse(formToTaskInput(form));
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Please check the form.");

    setError(null);
    setSaving(true);
    const result =
      props.mode === "new"
        ? await apiFetch(getIdToken, "/api/tasks", { method: "POST", body: parsed.data })
        : await apiFetch(getIdToken, `/api/tasks/${props.taskId}`, { method: "PATCH", body: taskToPatch(parsed.data) });
    setSaving(false);

    if (!result.ok) return setError(result.message);
    if (props.mode === "new") return router.push("/mentor/tasks");
    setNotice(form.status === "published" ? "Saved. Students can see this task." : "Saved as a draft.");
  }

  const isCoding = form.type === "coding";
  const locked = props.mode === "edit" && props.hasSubmissions === true;
  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-5" noValidate>
      <Field label="Title">
        <input value={form.title} onChange={(e) => update("title", e.target.value)} maxLength={120} className={inputClass} />
      </Field>

      <Field label="Type" hint={locked ? LOCKED_HINT : undefined}>
        <select
          value={form.type}
          disabled={locked}
          onChange={(e) => update("type", TASK_TYPES.find((type) => type === e.target.value) ?? form.type)}
          className={inputClass}
        >
          {TASK_TYPES.map((type) => (
            <option key={type} value={type}>
              {TASK_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium" id="description-label">
            Description (markdown)
          </span>
          <div className="flex gap-1" role="tablist" aria-label="Description view">
            {(["write", "preview"] as const).map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                onClick={() => setTab(name)}
                className={`min-h-9 rounded-md px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue-700 ${
                  tab === name ? "bg-black/10 dark:bg-white/15" : "opacity-70"
                }`}
              >
                {name === "write" ? "Write" : "Preview"}
              </button>
            ))}
          </div>
        </div>
        {tab === "write" ? (
          <textarea
            aria-labelledby="description-label"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={10}
            className={textareaClass}
          />
        ) : (
          <div className="min-h-40 rounded-lg border border-black/10 p-3 dark:border-white/15">
            {form.description.trim() ? <Markdown>{form.description}</Markdown> : <p className="opacity-60">Nothing to preview.</p>}
          </div>
        )}
      </div>

      <Field label="Due date and time (IST)">
        <input
          type="datetime-local"
          value={form.dueAtLocal}
          onChange={(e) => update("dueAtLocal", e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Max attempts" hint={`Leave blank for the default (${DEFAULT_MAX_ATTEMPTS[form.type]}).`}>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={10}
          value={form.maxAttempts}
          onChange={(e) => update("maxAttempts", e.target.value)}
          className={inputClass}
        />
      </Field>

      {isCoding && (
        <fieldset className="flex flex-col gap-5 rounded-lg border border-black/10 p-4 dark:border-white/15">
          <legend className="px-1 font-semibold">Coding settings</legend>
          <Field label="Problem slug" hint={locked ? LOCKED_HINT : "Must match a folder in the judge repo, e.g. two-sum."}>
            <input
              value={form.problemSlug}
              readOnly={locked}
              onChange={(e) => update("problemSlug", e.target.value.toLowerCase())}
              autoCapitalize="none"
              spellCheck={false}
              className={inputClass}
            />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="font-medium">Languages</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {LANGUAGES.map((language) => (
                <label key={language} className="flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.languages.includes(language)}
                    onChange={(e) => toggleLanguage(language, e.target.checked)}
                    className="h-5 w-5"
                  />
                  {LANGUAGE_LABEL[language]}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Time limit (ms)" hint="500 to 5000.">
            <input
              type="number"
              inputMode="numeric"
              min={500}
              max={5000}
              step={100}
              value={form.timeLimitMs}
              onChange={(e) => update("timeLimitMs", e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="flex flex-col gap-3">
            <span className="font-medium">Sample tests (shown to students, 1–5)</span>
            {form.sampleTests.map((test, index) => (
              <div key={index} className="flex flex-col gap-2 rounded-lg bg-black/[0.03] p-3 dark:bg-white/[0.05]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Sample {index + 1}</span>
                  {form.sampleTests.length > 1 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => update("sampleTests", form.sampleTests.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <Field label="Input">
                  <textarea value={test.input} onChange={(e) => updateSample(index, "input", e.target.value)} rows={3} className={textareaClass} />
                </Field>
                <Field label="Expected output">
                  <textarea value={test.output} onChange={(e) => updateSample(index, "output", e.target.value)} rows={3} className={textareaClass} />
                </Field>
              </div>
            ))}
            {form.sampleTests.length < 5 && (
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => update("sampleTests", [...form.sampleTests, { input: "", output: "" }])}
              >
                Add sample test
              </Button>
            )}
            <p className="text-sm opacity-70">Hidden tests are never entered here; they live only in the judge repo.</p>
          </div>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Visibility</legend>
        {(["draft", "published"] as const).map((status) => (
          <label key={status} className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="status"
              checked={form.status === status}
              onChange={() => update("status", status)}
              className="h-5 w-5"
            />
            {status === "draft" ? "Draft (only mentors and viewers see it)" : "Published (students see it)"}
          </label>
        ))}
      </fieldset>

      {error && (
        <Note tone="danger">{error}</Note>
      )}
      {notice && (
        <Note tone="success" live>
          {notice}
        </Note>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" busy={saving} busyLabel="Saving…">
          {props.mode === "new" ? "Create task" : "Save changes"}
        </Button>
        <Button variant="secondary" onClick={() => router.push("/mentor/tasks")}>
          Back to tasks
        </Button>
      </div>
    </form>
  );
}
