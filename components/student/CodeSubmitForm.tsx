"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { codeSize, insertIndent } from "@/lib/submissions/judgeDisplay";
import { LANGUAGE_LABEL, type Language } from "@/lib/validation/task";
import { ErrorNote, textareaClass } from "./FeedbackSubmitParts";
import type { CodeSubmitState } from "./useCodeSubmit";

type Props = {
  languages: readonly Language[];
  state: CodeSubmitState;
  onSubmit: (language: Language, code: string) => void;
};

/** Coding task: language (the task's only), a monospace code box where Tab inserts spaces, a 32 KB counter. */
export function CodeSubmitForm({ languages, state, onSubmit }: Props) {
  const [language, setLanguage] = useState<Language>(languages[0] ?? "python");
  const [code, setCode] = useState("");
  // After Escape, the next Tab moves focus as usual, so keyboard users are never trapped in the box.
  const escaped = useRef(false);
  const size = codeSize(code);
  const submitting = state.status === "submitting";

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      escaped.current = true;
      return;
    }
    const plainTab = event.key === "Tab" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
    if (plainTab && !escaped.current) {
      event.preventDefault();
      const box = event.currentTarget;
      const next = insertIndent(box.value, box.selectionStart, box.selectionEnd);
      setCode(next.value);
      requestAnimationFrame(() => box.setSelectionRange(next.cursor, next.cursor));
    }
    escaped.current = false;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(language, code);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <label htmlFor="code-language" className="font-medium">
        Language
      </label>
      <select
        id="code-language"
        value={language}
        onChange={(event) => {
          const picked = languages.find((lang) => lang === event.target.value);
          if (picked) setLanguage(picked);
        }}
        className="min-h-11 rounded-lg border border-black/20 bg-transparent px-3 dark:border-white/25"
      >
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {LANGUAGE_LABEL[lang]}
          </option>
        ))}
      </select>
      {language === "java" && <p className="text-sm opacity-80">Java: your class must be named Main.</p>}

      <label htmlFor="code-text" className="font-medium">
        Your code
      </label>
      <textarea
        id="code-text"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={16}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        aria-describedby="code-help code-size"
        className={`${textareaClass} font-mono text-sm leading-normal whitespace-pre`}
      />
      <p id="code-help" className="text-sm opacity-70">
        Read input from standard input and print the answer. Tab adds spaces; press Esc then Tab to leave the box.
      </p>
      <p id="code-size" aria-live="polite" className={`text-sm ${size.tooBig ? "text-red-700 dark:text-red-300" : "opacity-80"}`}>
        {size.tooBig ? `Too long: ${size.text}` : size.text}
      </p>

      <Button type="submit" disabled={size.tooBig || code.trim() === ""} busy={submitting} busyLabel="Sending…">
        Submit
      </Button>
      {state.status === "sent" && (
        <p role="status" className="text-sm">
          Sent to the judge. Watch the status under “Your attempts” below.
        </p>
      )}
      {state.status === "error" && <ErrorNote message={state.message} />}
    </form>
  );
}
