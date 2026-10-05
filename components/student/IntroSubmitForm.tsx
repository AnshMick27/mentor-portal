"use client";

import { useState, type FormEvent } from "react";
import { AiDataNote } from "@/components/PrivacyLink";
import { checkIntroLength } from "@/lib/submissions/wordCount";
import { MAX_INTRO_CHARS } from "@/lib/submissions/limits";
import { LimitStatus, PasteOffNote, SubmitFooter, textareaClass } from "./FeedbackSubmitParts";
import type { FeedbackSubmitState } from "./useFeedbackSubmit";
import { usePasteGuard } from "./usePasteGuard";

/** Written intro: textarea with a live word count (target 80–250), the 300–2,500 character limit, pasting off. */
export function IntroSubmitForm({ state, onSubmit }: { state: FeedbackSubmitState; onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  const paste = usePasteGuard(text, setText);
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
      <PasteOffNote id="intro-paste" blocked={paste.blocked} />
      <textarea
        id="intro-text"
        value={text}
        {...paste.boxProps}
        rows={10}
        maxLength={MAX_INTRO_CHARS + 500}
        aria-describedby="intro-paste intro-count"
        placeholder="Greeting, background, skills, projects or achievements, and your goals."
        className={textareaClass}
      />
      <p id="intro-count" className="flex flex-wrap justify-between gap-x-4 text-sm">
        <span className={check.wordsInTarget ? "text-green-800 dark:text-green-300" : "text-muted"}>
          {check.words} words · {check.wordHint}
        </span>
        <span className={check.charError && check.chars > 0 ? "text-red-700 dark:text-red-300" : "text-muted"}>
          {check.charError ?? `${check.chars} / ${MAX_INTRO_CHARS.toLocaleString("en-IN")} characters`}
        </span>
      </p>
      <LimitStatus message={check.chars > MAX_INTRO_CHARS ? "Too long" : check.wordsInTarget ? "In the target range" : ""} />
      <AiDataNote />
      <SubmitFooter state={state} disabledReason={check.charError} />
    </form>
  );
}
