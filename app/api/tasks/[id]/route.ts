import { jsonError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parseBody";
import { requireUser } from "@/lib/auth/requireUser";
import { recomputeAllAfter } from "@/lib/stats/recompute";
import { deleteTask, getTask, taskHasSubmissions, updateTask, type TaskResult } from "@/lib/tasks/taskStore";
import { isValidTaskId, taskPatchSchema } from "@/lib/validation/task";

function respond(result: TaskResult): Response {
  return result.ok ? Response.json({ task: result.task }) : jsonError(result.status, result.message);
}

/** Mentor/viewer: one task (drafts included), e.g. for the edit form, plus whether it has submissions. */
export async function GET(request: Request, ctx: RouteContext<"/api/tasks/[id]">): Promise<Response> {
  const auth = await requireUser(request, ["mentor", "viewer"]);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!isValidTaskId(id)) return jsonError(404, "Task not found.");
  try {
    const result = await getTask(id);
    if (!result.ok) return respond(result);
    return Response.json({ task: result.task, hasSubmissions: await taskHasSubmissions(id) });
  } catch (error) {
    console.error(`GET /api/tasks/${id} failed:`, error);
    return jsonError(500, "Could not load the task. Please try again.");
  }
}

/** Mentor only: edit any fields, including `status` to publish or unpublish. Recomputes stats when needed. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/tasks/[id]">): Promise<Response> {
  const auth = await requireUser(request, ["mentor"]);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!isValidTaskId(id)) return jsonError(404, "Task not found.");
  const body = await parseBody(request, taskPatchSchema);
  if (!body.ok) return body.response;
  let result;
  try {
    result = await updateTask(id, body.data);
  } catch (error) {
    console.error(`PATCH /api/tasks/${id} failed:`, error);
    return jsonError(500, "Could not save the task. Please try again.");
  }
  // Publishing, unpublishing, or moving a due date changes every student's due/missed counts.
  if (result.ok && result.affectsStats) await recomputeAllAfter(`PATCH /api/tasks/${id}`);
  return respond(result);
}

/** Mentor only: delete a task (T37). Submissions are kept but stop counting; stats are recomputed. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/tasks/[id]">): Promise<Response> {
  const auth = await requireUser(request, ["mentor"]);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!isValidTaskId(id)) return jsonError(404, "Task not found.");
  let result;
  try {
    result = await deleteTask(id);
  } catch (error) {
    console.error(`DELETE /api/tasks/${id} failed:`, error);
    return jsonError(500, "Could not delete the task. Please try again.");
  }
  if (!result.ok) return jsonError(result.status, result.message);
  // Due/missed counts, averages and recent scores all change once the task is gone.
  await recomputeAllAfter(`DELETE /api/tasks/${id}`);
  return Response.json({ deleted: true });
}
