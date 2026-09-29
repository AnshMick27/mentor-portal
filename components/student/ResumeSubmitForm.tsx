"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { MAX_RESUME_CHARS } from "@/lib/submissions/limits";
import { extractPdfText, PdfTextError } from "@/lib/submissions/pdfText";
import { ErrorNote, SubmitFooter, textareaClass } from "./FeedbackSubmitParts";
import type { FeedbackSubmitState } from "./useFeedbackSubmit";

type PdfState = { status: "none" } | { status: "reading" } | { status: "read"; fileName: string } | { status: "error"; message: string };

/**
 * Resume: pick a PDF (text extracted here in the browser; the file is never sent) or paste text. The text box
 * always shows exactly what will be sent, so the student can check and fix it before submitting.
 */
export function ResumeSubmitForm({ state, onSubmit }: { state: FeedbackSubmitState; onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  const [pdf, setPdf] = useState<PdfState>({ status: "none" });
  const chars = text.trim().length;
  const tooLong = chars > MAX_RESUME_CHARS;

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPdf({ status: "reading" });
    try {
      const { loadPdfWithPdfjs } = await import("@/lib/submissions/pdfjsLoader");
      setText(await extractPdfText(file, loadPdfWithPdfjs));
      setPdf({ status: "read", fileName: file.name });
    } catch (error) {
      if (!(error instanceof PdfTextError)) console.error(error);
      const message = error instanceof PdfTextError ? error.message : "Could not read this PDF. Please paste your resume text instead.";
      setPdf({ status: "error", message });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(text);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <label htmlFor="resume-pdf" className="font-medium">
        Resume PDF
      </label>
      <input
        id="resume-pdf"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => void handleFile(event)}
        disabled={pdf.status === "reading"}
        aria-describedby="resume-pdf-help"
        className="text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-black/[0.07] file:px-4 file:font-medium dark:file:bg-white/[0.12]"
      />
      <p id="resume-pdf-help" className="text-sm opacity-80">
        Your PDF stays on your device: only the text below is sent for feedback. You can also paste your text.
      </p>
      {pdf.status === "reading" && <p role="status" className="text-sm">Reading your PDF…</p>}
      {pdf.status === "error" && <ErrorNote message={pdf.message} />}

      <label htmlFor="resume-text" className="mt-2 font-medium">
        Resume text
      </label>
      {pdf.status === "read" && (
        <p role="status" className="text-sm">
          Text taken from <span className="font-medium break-all">{pdf.fileName}</span>. Check it below and fix anything that
          came out wrong before you submit.
        </p>
      )}
      <textarea
        id="resume-text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={14}
        aria-describedby="resume-count"
        placeholder="Paste your resume text here, or choose a PDF above."
        className={textareaClass}
      />
      <p id="resume-count" aria-live="polite" className={`text-sm ${tooLong ? "text-red-700 dark:text-red-300" : "opacity-80"}`}>
        {chars.toLocaleString("en-IN")} / {MAX_RESUME_CHARS.toLocaleString("en-IN")} characters
        {tooLong && " — please shorten it"}
      </p>
      <SubmitFooter state={state} disabled={chars === 0 || tooLong || pdf.status === "reading"} />
    </form>
  );
}
