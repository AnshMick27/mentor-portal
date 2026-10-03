import { useId, type ReactNode } from "react";

/**
 * Field borders use `border-line-strong` (about 3.4:1 light, 3.8:1 dark), so students can see where to type even on
 * a sunlit phone (WCAG 1.4.11, docs/UX_REVIEW.md UX-06). Card borders stay `border-line`: they are decorative.
 */
export const inputClasses =
  "min-h-11 w-full rounded-md border border-line-strong bg-card px-3 text-base disabled:opacity-60 [&:is(input):read-only]:opacity-60";
export const textareaClasses =
  "w-full rounded-md border border-line-strong bg-card p-3 text-base leading-relaxed disabled:opacity-60 read-only:opacity-60";

/** What `Field` hands to its control: spread it onto the input, select or textarea. */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

/**
 * A labelled form field (docs/UX_REVIEW.md §3.2): label, optional hint, the control, and its error right under it.
 * Wires `id`, `aria-describedby` (hint + error) and `aria-invalid` so screen readers read the error with the field.
 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {children({ id, "aria-describedby": describedBy, ...(error ? { "aria-invalid": true as const } : {}) })}
      {error && (
        <p id={errorId} className="text-sm font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
