import { jsonError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/requireUser";
import { loadExportInput } from "@/lib/export/load";
import { buildExportWorkbook, exportFilename, XLSX_CONTENT_TYPE } from "@/lib/export/workbook";

// Reads every student, task and finished submission once, then builds the workbook in memory.
export const maxDuration = 60;

/** Mentor and viewer: the class as an Excel file (SPEC.md §8.6). Never contains submission content. */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request, ["mentor", "viewer"]);
  if (!auth.ok) return auth.response;
  try {
    const now = new Date();
    const bytes = await buildExportWorkbook(await loadExportInput(), now);
    return new Response(bytes, {
      headers: {
        "content-type": XLSX_CONTENT_TYPE,
        "content-disposition": `attachment; filename="${exportFilename(now)}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/export failed:", error);
    return jsonError(500, "Could not build the export. Please try again.");
  }
}
