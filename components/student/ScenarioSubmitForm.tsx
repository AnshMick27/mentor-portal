"use client";

import { useState, type FormEvent } from "react";
import { AiDataNote } from "@/components/PrivacyLink";
import { MAX_SCENARIO_CHARS } from "@/lib/submissions/limits";
import { countWords, scenarioCharError } from "@/lib/submissions/wordCount";
import type { IntegrityCounts } from "@/lib/validation/submission";
import { LimitStatus, PasteOffNote, SubmitFooter, textareaClass } from "./FeedbackSubmitParts";
import type { FeedbackSubmitState } from "./useFeedbackSubmit";
import { usePasteGuard } from "./usePasteGuard";

/** Scenario answer (T50): typed in the student's own words (pasting off), 200–5,000 characters. */
export function ScenarioSubmitForm({
  state,
  onSubmit,
}: {
  state: FeedbackSubmitState;
  onSubmit: (text: string, integrity: IntegrityCounts) => void;
}) {
  const [text, setText] = useState("");
  const paste = usePasteGuard(text, setText);
  const chars = text.trim().length;
  const charError = scenarioCharError(text);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(text, paste.counts());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <label htmlFor="scenario-text" className="font-medium">
        Your answer
      </label>
      <PasteOffNote id="scenario-paste" blocked={paste.blocked} />
      <textarea
        id="scenario-text"
        value={text}
        {...paste.boxProps}
        rows={12}
        maxLength={MAX_SCENARIO_CHARS + 500}
        aria-describedby="scenario-paste scenario-count"
        placeholder="What is going on, what you would do step by step, and why."
        className={textareaClass}
      />
      <p id="scenario-count" className="flex flex-wrap justify-between gap-x-4 text-sm">
        <span className="text-muted">{countWords(text)} words</span>
        <span className={charError && chars > 0 ? "text-red-700 dark:text-red-300" : "text-muted"}>
          {charError ?? `${chars} / ${MAX_SCENARIO_CHARS.toLocaleString("en-IN")} characters`}
        </span>
      </p>
      <LimitStatus message={chars > MAX_SCENARIO_CHARS ? "Too long" : ""} />
      <AiDataNote />
      <SubmitFooter state={state} disabledReason={charError} />
    </form>
  );
}
