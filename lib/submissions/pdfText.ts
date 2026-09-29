/**
 * Resume PDF → plain text, IN THE BROWSER (SPEC.md §4, §8.4): the file itself is never uploaded or stored.
 * The pdf.js parts are injected, so the logic is testable without a real PDF or worker.
 */

/** A PDF larger than this is almost certainly not a one-page resume. */
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
/** Only the first pages are read; resumes should be one page, two at most. */
export const MAX_PDF_PAGES = 3;

/** The slice of pdf.js's API we use (structurally compatible with `pdfjs-dist`). */
export type PdfTextItem = { str: string; hasEOL: boolean } | { type: string };
export type PdfPage = { getTextContent(): Promise<{ items: PdfTextItem[] }> };
export type PdfDocument = { numPages: number; getPage(pageNumber: number): Promise<PdfPage>; destroy(): Promise<void> };
export type PdfLoader = (data: Uint8Array) => Promise<PdfDocument>;

export class PdfTextError extends Error {}

/** Joins text items into lines, collapsing runs of spaces and blank lines. */
export function itemsToText(items: PdfTextItem[]): string {
  let text = "";
  for (const item of items) {
    if (!("str" in item)) continue;
    text += item.str;
    if (item.hasEOL) text += "\n";
  }
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extracts the text of a resume PDF. Throws `PdfTextError` with a plain-English message. */
export async function extractPdfText(file: { size: number; arrayBuffer(): Promise<ArrayBuffer> }, load: PdfLoader): Promise<string> {
  if (file.size > MAX_PDF_BYTES) throw new PdfTextError("This PDF is larger than 5 MB. Please choose a smaller file.");

  let pdf: PdfDocument;
  try {
    pdf = await load(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new PdfTextError("Could not open this PDF. Check the file, or paste your resume text instead.");
  }

  try {
    const pages: string[] = [];
    for (let n = 1; n <= Math.min(pdf.numPages, MAX_PDF_PAGES); n++) {
      const content = await (await pdf.getPage(n)).getTextContent();
      pages.push(itemsToText(content.items));
    }
    const text = pages.filter(Boolean).join("\n\n");
    if (!text) {
      throw new PdfTextError("No text found in this PDF (it may be a scanned image). Please paste your resume text instead.");
    }
    return text;
  } catch (error) {
    if (error instanceof PdfTextError) throw error;
    throw new PdfTextError("Could not read the text in this PDF. Please paste your resume text instead.");
  } finally {
    void pdf.destroy().catch(() => undefined);
  }
}
