import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import type { ExportInput, ExportResult, ExportStudent, ExportTask } from "@/lib/export/workbook";
import { submissionDocToView } from "@/lib/submissions/submissionDoc";
import { taskDocToDto } from "@/lib/tasks/taskDoc";
import { storedStudentStatsSchema } from "@/lib/validation/stats";
import { storedUserSchema } from "@/lib/validation/user";

/**
 * Reads what the export needs with the Admin SDK: onboarded students, their stats, published tasks and
 * finished submissions. Submission `content` is read (one doc is one read) but dropped here, never exported.
 */
export async function loadExportInput(): Promise<ExportInput> {
  const db = getAdminDb();
  const [users, stats, tasks, submissions] = await Promise.all([
    db.collection("users").where("role", "==", "student").get(),
    db.collection("studentStats").get(),
    db.collection("tasks").where("status", "==", "published").get(),
    db.collection("submissions").where("status", "==", "done").get(),
  ]);

  const statsByUid = new Map(
    stats.docs.flatMap((doc) => {
      const parsed = storedStudentStatsSchema.safeParse(doc.data());
      return parsed.success ? [[doc.id, parsed.data] as const] : [];
    }),
  );

  const students: ExportStudent[] = users.docs.flatMap((doc) => {
    const parsed = storedUserSchema.safeParse(doc.data());
    if (!parsed.success || !parsed.data.onboarded || parsed.data.removed === true || parsed.data.pendingApproval === true) return [];
    const user = parsed.data;
    const s = statsByUid.get(doc.id);
    return [
      {
        uid: doc.id,
        name: user.name,
        email: user.email,
        rollNo: user.rollNo ?? "",
        branch: user.branch ?? "",
        ...(s
          ? {
              stats: {
                tasksDue: s.tasksDue,
                tasksSubmitted: s.tasksSubmitted,
                missedCount: s.missedCount,
                avgBySkill: s.avgBySkill,
                needsAttention: s.needsAttention,
                ...(s.overallAvg === undefined ? {} : { overallAvg: s.overallAvg }),
                ...(s.needsAttentionReason === undefined ? {} : { needsAttentionReason: s.needsAttentionReason }),
              },
            }
          : {}),
      },
    ];
  });

  const exportTasks: ExportTask[] = tasks.docs.flatMap((doc) => {
    const task = taskDocToDto(doc.id, doc.data());
    return task ? [{ id: task.id, title: task.title, type: task.type, dueAt: new Date(task.dueAt) }] : [];
  });

  const results: ExportResult[] = submissions.docs.flatMap((doc) => {
    const view = submissionDocToView(doc.id, doc.data());
    // Late attempts (T44) are feedback only: they never reach the export, like every other score view.
    if (!view?.result || view.late === true) return [];
    const { uid, taskId, type, attempt, createdAt, result } = view;
    return [
      { uid, taskId, type, attempt, createdAt, score: result.score, summary: result.summary, ...(result.judge ? { judge: result.judge } : {}) },
    ];
  });

  return { students, tasks: exportTasks, results };
}
