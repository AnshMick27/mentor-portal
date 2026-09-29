import type { PdfLoader } from "./pdfText";

/**
 * Browser-only pdf.js loader. pdf.js (and its worker) is imported on demand, so it is not in the page bundle
 * until a student picks a PDF.
 */
export const loadPdfWithPdfjs: PdfLoader = async (data) => {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  return {
    numPages: pdf.numPages,
    getPage: (pageNumber) => pdf.getPage(pageNumber),
    // pdf.js v6 frees the document and its worker through the loading task.
    destroy: () => loadingTask.destroy(),
  };
};
