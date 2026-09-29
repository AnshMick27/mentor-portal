"use client";

import { useState, type FormEvent } from "react";
import { checkIntroLength } from "@/lib/submissions/wordCount";
import { MAX_INTRO_CHARS } from "@/lib/submissions/limits";
import { SubmitFooter, textareaClass } from "./FeedbackSubmitParts";
import type { FeedbackSubmitState } from "./useFeedbackSubmit";

/** Written intro: textarea with a live word count (target 80–250) and the 300–2,500 character limit. */
export function IntroSubmitForm({ state, onSubmit }: { state: FeedbackSubmitState; onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  const check = checkIntroLength(text);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(text);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <label htmlFor="intro-text" className="font-medium">
        Your introduction
      </label>
      <textarea
        id="intro-text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={10}
        maxLength={MAX_INTRO_CHARS + 500}
        aria-describedby="intro-count"
        placeholder="Greeting, background, skills, projects or achievements, and your goals."
        className={textareaClass}
      />
      <p id="intro-count" aria-live="polite" className="flex flex-wrap justify-between gap-x-4 text-sm">
        <span className={check.wordsInTarget ? "text-green-800 dark:text-green-300" : "opacity-80"}>
          {check.words} words · {check.wordHint}
        </span>
        <span className={check.charError && check.chars > 0 ? "text-red-700 dark:text-red-300" : "opacity-80"}>
          {check.charError ?? `${check.chars} / ${MAX_INTRO_CHARS.toLocaleString("en-IN")} characters`}
        </span>
      </p>
      <SubmitFooter state={state} disabled={check.charError !== undefined} />
    </form>
  );
}
