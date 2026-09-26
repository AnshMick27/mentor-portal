import { jsonError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parseBody";
import { requireUser } from "@/lib/auth/requireUser";
import { getTask, updateTask, type TaskResult } from "@/lib/tasks/taskStore";
import { isValidTaskId, taskPatchSchema } from "@/lib/validation/task";

function respond(result: TaskResult): Response {
  return result.ok ? Response.json({ task: result.task }) : jsonError(result.status, result.message);
}

/** Mentor/viewer: one task (drafts included), e.g. for the edit form. */
export async function GET(request: Request, ctx: RouteContext<"/api/tasks/[id]">): Promise<Response> {
  const auth = await requireUser(request, ["mentor", "viewer"]);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!isValidTaskId(id)) return jsonError(404, "Task not found.");
  try {
    return respond(await getTask(id));
  } catch (error) {
    console.error(`GET /api/tasks/${id} failed:`, error);
    return jsonError(500, "Could not load the task. Please try again.");
  }
}

/** Mentor only: edit any fields, including `status` to publish or unpublish. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/tasks/[id]">): Promise<Response> {
  const auth = await requireUser(request, ["mentor"]);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  if (!isValidTaskId(id)) return jsonError(404, "Task not found.");
  const body = await parseBody(request, taskPatchSchema);
  if (!body.ok) return body.response;
  try {
    return respond(await updateTask(id, body.data));
  } catch (error) {
    console.error(`PATCH /api/tasks/${id} failed:`, error);
    return jsonError(500, "Could not save the task. Please try again.");
  }
}
