"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/Button";
import { cardClasses } from "@/components/ui/Card";
import { Field, inputClasses } from "@/components/ui/Field";
import { Note } from "@/components/ui/Note";
import { apiFetch } from "@/lib/api/client";
import { formToTaskInput, taskToPatch, type TaskFormState } from "@/lib/tasks/taskForm";
import {
  DEFAULT_MAX_ATTEMPTS,
  LANGUAGE_LABEL,
  LATE_GRACE_DAYS,
  LANGUAGES,
  TASK_TYPE_LABEL,
  TASK_TYPES,
  taskInputSchema,
  type Language,
} from "@/lib/validation/task";

const inputClass = inputClasses;
const textareaClass = `${inputClass} py-2 font-mono text-sm`;

/** Form fields that can carry their own error message. */
export type TaskFieldKey =
  | "title"
  | "type"
  | "description"
  | "dueAtLocal"
  | "lateUntilLocal"
  | "maxAttempts"
  | "problemSlug"
  | "languages"
  | "timeLimitMs"
  | "sampleTests";
export type TaskFieldErrors = Partial<Record<TaskFieldKey, string>>;

const TOP_LEVEL_KEYS: Record<string, TaskFieldKey> = {
  title: "title",
  type: "type",
  description: "description",
  dueAt: "dueAtLocal",
  lateUntil: "lateUntilLocal",
  maxAttempts: "maxAttempts",
};
const CODING_KEYS: Record<string, TaskFieldKey> = {
  problemSlug: "problemSlug",
  languages: "languages",
  timeLimitMs: "timeLimitMs",
  sampleTests: "sampleTests",
};

/**
 * Puts each validation message under the field it is about (UX-21): zod paths of the API input (`dueAt`,
 * `coding.problemSlug`, …) map back to the form's fields. The first message per field wins; a message with no
 * field comes back as `other`.
 */
export function taskFieldErrors(issues: readonly { path: readonly PropertyKey[]; message: string }[]): {
  fields: TaskFieldErrors;
  other?: string;
} {
  const fields: TaskFieldErrors = {};
  let other: string | undefined;
  for (const issue of issues) {
    const [first, second] = issue.path;
    const key = first === "coding" ? CODING_KEYS[String(second)] : TOP_LEVEL_KEYS[String(first)];
    if (key) fields[key] ??= issue.message;
    else other ??= issue.message;
  }
  return { fields, other };
}

const sameForm = (a: TaskFormState, b: TaskFormState) => JSON.stringify(a) === JSON.stringify(b);

/** In edit mode, `hasSubmissions` locks the type and problem slug (the API refuses those changes too). */
type Props = { initial: TaskFormState } & ({ mode: "new" } | { mode: "edit"; taskId: string; hasSubmissions?: boolean });

const LOCKED_HINT = "Locked: students have already submitted to this task.";

/** Create/edit form for mentors. Validates with the same zod schema as the API before sending. */
export function TaskForm(props: Props) {
  const { getIdToken } = useAuth();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<TaskFormState>(props.initial);
  const [saved, setSaved] = useState<TaskFormState>(props.initial);
  const [preview, setPreview] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<TaskFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const dirty = !sameForm(form, saved);

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

  function showErrors(fields: TaskFieldErrors, other?: string) {
    setFieldErrors(fields);
    setError(other ?? "Please fix the fields marked below.");
    // Take keyboard and screen-reader users straight to the first problem.
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.dueAtLocal) return showErrors({ dueAtLocal: "Choose a due date and time." });
    const parsed = taskInputSchema.safeParse(formToTaskInput(form));
    if (!parsed.success) {
      const { fields, other } = taskFieldErrors(parsed.error.issues);
      return showErrors(fields, Object.keys(fields).length === 0 ? (other ?? "Please check the form.") : other);
    }

    setFieldErrors({});
    setError(null);
    setSaving(true);
    const result =
      props.mode === "new"
        ? await apiFetch(getIdToken, "/api/tasks", { method: "POST", body: parsed.data })
        : await apiFetch(getIdToken, `/api/tasks/${props.taskId}`, { method: "PATCH", body: taskToPatch(parsed.data) });
    setSaving(false);

    if (!result.ok) return setError(result.message);
    setSaved(form);
    if (props.mode === "new") return router.push("/mentor/tasks?created=1");
    setNotice(form.status === "published" ? "Saved. Students can see this task." : "Saved as a draft.");
  }

  function leave() {
    if (dirty && !confirmLeave) return setConfirmLeave(true);
    router.push("/mentor/tasks");
  }

  const isCoding = form.type === "coding";
  const locked = props.mode === "edit" && props.hasSubmissions === true;
  return (
    <form ref={formRef} onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-6" noValidate>
      <div className={cardClasses({ padding: "none", className: "flex flex-col gap-5 p-4 sm:p-6" })}>
      <Field label="Title (required)" error={fieldErrors.title}>
        {(control) => (
          <input {...control} value={form.title} onChange={(e) => update("title", e.target.value)} maxLength={120} className={inputClass} />
        )}
      </Field>

      <Field label="Type" hint={locked ? LOCKED_HINT : undefined} error={fieldErrors.type}>
        {(control) => (
          <select
            {...control}
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
        )}
      </Field>

      <DescriptionField
        value={form.description}
        preview={preview}
        error={fieldErrors.description}
        onPreview={setPreview}
        onChange={(value) => update("description", value)}
      />

      <Field label="Due date and time (IST, required)" error={fieldErrors.dueAtLocal}>
        {(control) => (
          <input
            {...control}
            type="datetime-local"
            value={form.dueAtLocal}
            onChange={(e) => update("dueAtLocal", e.target.value)}
            className={inputClass}
          />
        )}
      </Field>

      <Field
        label="Late work accepted until (IST)"
        hint={`After the due date students can still send work for feedback (not scored). Leave blank for ${LATE_GRACE_DAYS} days after the due date.`}
        error={fieldErrors.lateUntilLocal}
      >
        {(control) => (
          <input
            {...control}
            type="datetime-local"
            value={form.lateUntilLocal}
            min={form.dueAtLocal || undefined}
            onChange={(e) => update("lateUntilLocal", e.target.value)}
            className={inputClass}
          />
        )}
      </Field>

      <Field label="Max attempts" hint={`Leave blank for the default (${DEFAULT_MAX_ATTEMPTS[form.type]}).`} error={fieldErrors.maxAttempts}>
        {(control) => (
          <input
            {...control}
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            value={form.maxAttempts}
            onChange={(e) => update("maxAttempts", e.target.value)}
            className={inputClass}
          />
        )}
      </Field>
      </div>

      {isCoding && (
        <fieldset className={cardClasses({ padding: "none", className: "flex flex-col gap-5 p-4 sm:p-6" })}>
          <legend className="float-left mb-1 w-full text-lg font-semibold">Coding settings</legend>
          <Field
            label="Problem slug (required)"
            hint={locked ? LOCKED_HINT : "Must match a folder in the judge repo, e.g. two-sum."}
            error={fieldErrors.problemSlug}
          >
            {(control) => (
              <input
                {...control}
                value={form.problemSlug}
                readOnly={locked}
                onChange={(e) => update("problemSlug", e.target.value.toLowerCase())}
                autoCapitalize="none"
                spellCheck={false}
                className={inputClass}
              />
            )}
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
                    aria-invalid={fieldErrors.languages ? true : undefined}
                    className="h-5 w-5"
                  />
                  {LANGUAGE_LABEL[language]}
                </label>
              ))}
            </div>
            <FieldError message={fieldErrors.languages} />
          </fieldset>

          <Field label="Time limit (ms)" hint="500 to 5000." error={fieldErrors.timeLimitMs}>
            {(control) => (
              <input
                {...control}
                type="number"
                inputMode="numeric"
                min={500}
                max={5000}
                step={100}
                value={form.timeLimitMs}
                onChange={(e) => update("timeLimitMs", e.target.value)}
                className={inputClass}
              />
            )}
          </Field>

          <div className="flex flex-col gap-3">
            <span className="font-medium">Sample tests (shown to students, 1–5)</span>
            <FieldError message={fieldErrors.sampleTests} />
            {form.sampleTests.map((test, index) => (
              <div key={index} className="flex flex-col gap-2 rounded-lg bg-surface p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Sample {index + 1}</span>
                  {form.sampleTests.length > 1 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Remove sample ${index + 1}`}
                      onClick={() => update("sampleTests", form.sampleTests.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <Field label="Input">
                  {(control) => (
                    <textarea
                      {...control}
                      value={test.input}
                      onChange={(e) => updateSample(index, "input", e.target.value)}
                      rows={3}
                      className={textareaClass}
                    />
                  )}
                </Field>
                <Field label="Expected output">
                  {(control) => (
                    <textarea
                      {...control}
                      value={test.output}
                      onChange={(e) => updateSample(index, "output", e.target.value)}
                      rows={3}
                      className={textareaClass}
                    />
                  )}
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
            <p className="text-sm text-muted">Hidden tests are never entered here; they live only in the judge repo.</p>
          </div>
        </fieldset>
      )}

      <fieldset className={cardClasses({ padding: "none", className: "flex flex-col gap-2 p-4 sm:p-6" })}>
        <legend className="float-left mb-1 w-full text-lg font-semibold">Visibility</legend>
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

      {error && <Note tone="danger">{error}</Note>}
      {notice && (
        <Note tone="success" live>
          {notice}
        </Note>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" busy={saving} busyLabel="Saving…">
          {props.mode === "new" ? "Create task" : "Save changes"}
        </Button>
        <Button variant="secondary" onClick={leave}>
          Back to tasks
        </Button>
      </div>
      {confirmLeave && dirty && <LeaveConfirm onLeave={leave} onStay={() => setConfirmLeave(false)} />}
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm font-medium text-red-700 dark:text-red-300">{message}</p>;
}

/**
 * Description with a Write/Preview switch: two toggle buttons (`aria-pressed`) rather than tabs, because there is
 * no tab panel or arrow-key handling (UX-21). Both buttons are 44 px tall.
 */
export function DescriptionField({
  value,
  preview,
  error,
  onPreview,
  onChange,
}: {
  value: string;
  preview: boolean;
  error?: string;
  onPreview: (preview: boolean) => void;
  onChange: (value: string) => void;
}) {
  const toggle = (on: boolean) =>
    `inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
      on ? "bg-surface ring-1 ring-inset ring-line-strong" : "text-muted hover:bg-surface"
    }`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium" id="description-label">
          Description (markdown, required)
        </span>
        <div className="flex gap-1" role="group" aria-label="Description view">
          <button type="button" aria-pressed={!preview} onClick={() => onPreview(false)} className={toggle(!preview)}>
            Write
          </button>
          <button type="button" aria-pressed={preview} onClick={() => onPreview(true)} className={toggle(preview)}>
            Preview
          </button>
        </div>
      </div>
      {preview ? (
        <div role="region" aria-labelledby="description-label" className="min-h-40 rounded-lg border border-line p-3">
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-muted">Nothing to preview.</p>}
        </div>
      ) : (
        <textarea
          aria-labelledby="description-label"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "description-error" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={10}
          className={textareaClass}
        />
      )}
      {error && (
        <p id="description-error" className="text-sm font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

/** Inline "are you sure" before throwing away edits, like the Remove-student confirm. */
export function LeaveConfirm({ onLeave, onStay }: { onLeave: () => void; onStay: () => void }) {
  return (
    <Note tone="warning" title="Leave without saving?">
      <p>Your changes to this task will be lost.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="danger" size="sm" onClick={onLeave}>
          Leave without saving
        </Button>
        <Button variant="secondary" size="sm" onClick={onStay}>
          Stay here
        </Button>
      </div>
    </Note>
  );
}
