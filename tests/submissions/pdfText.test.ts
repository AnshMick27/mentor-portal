import { describe, expect, it, vi } from "vitest";
import {
  extractPdfText,
  itemsToText,
  MAX_PDF_BYTES,
  MAX_PDF_PAGES,
  PdfTextError,
  type PdfDocument,
  type PdfTextItem,
} from "@/lib/submissions/pdfText";

const item = (str: string, hasEOL = false): PdfTextItem => ({ str, hasEOL });

function fakeFile(size = 1000) {
  return { size, arrayBuffer: vi.fn(async () => new ArrayBuffer(8)) };
}

/** A pdf.js-shaped document whose pages hold the given text items. */
function fakePdf(pages: PdfTextItem[][]) {
  const destroy = vi.fn(async () => undefined);
  const getPage = vi.fn(async (n: number) => ({ getTextContent: async () => ({ items: pages[n - 1] ?? [] }) }));
  const doc: PdfDocument = { numPages: pages.length, getPage, destroy };
  return { doc, getPage, destroy, load: vi.fn(async () => doc) };
}

describe("itemsToText", () => {
  it("joins items, breaks lines at hasEOL, collapses spaces and blank lines, skips marked content", () => {
    const items: PdfTextItem[] = [
      item("Ansh   Sharma", true),
      { type: "beginMarkedContent" },
      item("B.Tech "),
      item("CSE", true),
      item("", true),
      item("", true),
      item("", true),
      item("  Skills: C++,  Java ", true),
    ];
    expect(itemsToText(items)).toBe("Ansh Sharma\nB.Tech CSE\n\nSkills: C++, Java");
  });
});

describe("extractPdfText (pdf.js mocked)", () => {
  it("reads the text of every page and passes the file bytes to pdf.js", async () => {
    const pdf = fakePdf([[item("Page one", true)], [item("Page two")]]);
    const file = fakeFile();
    await expect(extractPdfText(file, pdf.load)).resolves.toBe("Page one\n\nPage two");
    expect(pdf.load).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(pdf.destroy).toHaveBeenCalled();
  });

  it(`reads at most ${MAX_PDF_PAGES} pages`, async () => {
    const pdf = fakePdf(Array.from({ length: 6 }, (_, i) => [item(`p${i + 1}`)]));
    await expect(extractPdfText(fakeFile(), pdf.load)).resolves.toBe("p1\n\np2\n\np3");
    expect(pdf.getPage).toHaveBeenCalledTimes(MAX_PDF_PAGES);
  });

  it("refuses a file over 5 MB without opening it (exactly 5 MB is fine)", async () => {
    const big = fakePdf([[item("x")]]);
    await expect(extractPdfText(fakeFile(MAX_PDF_BYTES + 1), big.load)).rejects.toThrow("larger than 5 MB");
    expect(big.load).not.toHaveBeenCalled();
    await expect(extractPdfText(fakeFile(MAX_PDF_BYTES), big.load)).resolves.toBe("x");
  });

  it("explains a PDF with no text (scanned image)", async () => {
    const pdf = fakePdf([[item("   ", true)]]);
    await expect(extractPdfText(fakeFile(), pdf.load)).rejects.toThrow("No text found");
    expect(pdf.destroy).toHaveBeenCalled();
  });

  it("turns a broken PDF into a plain-English PdfTextError", async () => {
    const load = vi.fn(async () => {
      throw new Error("Invalid PDF structure");
    });
    const error = await extractPdfText(fakeFile(), load).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PdfTextError);
    expect((error as Error).message).toContain("Could not open this PDF");
  });

  it("turns a failure while reading a page into a PdfTextError and still cleans up", async () => {
    const pdf = fakePdf([[item("x")]]);
    pdf.getPage.mockRejectedValueOnce(new Error("bad page"));
    await expect(extractPdfText(fakeFile(), pdf.load)).rejects.toThrow("Could not read the text");
    expect(pdf.destroy).toHaveBeenCalled();
  });
});
