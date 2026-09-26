import { jsonError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/parseBody";
import { requireUser } from "@/lib/auth/requireUser";
import { createTask, listTasks } from "@/lib/tasks/taskStore";
import { taskInputSchema } from "@/lib/validation/task";

/** Mentor/viewer: every task, drafts included. */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request, ["mentor", "viewer"]);
  if (!auth.ok) return auth.response;
  try {
    return Response.json({ tasks: await listTasks() });
  } catch (error) {
    console.error("GET /api/tasks failed:", error);
    return jsonError(500, "Could not load tasks. Please try again.");
  }
}

/** Mentor only: create a task (draft unless `status: "published"` is sent). */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser(request, ["mentor"]);
  if (!auth.ok) return auth.response;
  const body = await parseBody(request, taskInputSchema);
  if (!body.ok) return body.response;
  try {
    return Response.json({ task: await createTask(body.data, auth.value.uid) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks failed:", error);
    return jsonError(500, "Could not save the task. Please try again.");
  }
}
