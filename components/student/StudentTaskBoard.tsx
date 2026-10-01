import Link from "next/link";
import { formatIst } from "@/lib/dates/ist";
import type { StudentBoard, StudentTask } from "@/lib/tasks/studentBoard";
import { TASK_TYPE_LABEL } from "@/lib/validation/task";

function TaskCard({ task }: { task: StudentTask }) {
  return (
    <li>
      <Link
        href={`/student/tasks/${task.id}`}
        className="flex flex-col gap-1 rounded-lg border border-black/10 p-4 hover:bg-black/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/15 dark:hover:bg-white/[0.05]"
      >
        <span className="font-semibold break-words">{task.title}</span>
        <span className="text-sm opacity-75">
          {TASK_TYPE_LABEL[task.type]} · Due {formatIst(task.dueAt)}
        </span>
        <span className="text-sm opacity-75">
          Attempts: {task.attemptsUsed} of {task.maxAttempts} used
          {task.bestScore !== undefined && <> · Best {task.bestScore.toFixed(1)} / 10</>}
        </span>
      </Link>
    </li>
  );
}

function Group({ title, tasks, empty }: { title: string; tasks: StudentTask[]; empty: string }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="text-lg font-semibold">
        {title} <span className="text-sm font-normal opacity-60">({tasks.length})</span>
      </h2>
      {tasks.length === 0 ? (
        <p className="text-sm opacity-70">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function StudentTaskBoard({ board }: { board: StudentBoard }) {
  return (
    <div className="flex flex-col gap-8">
      <Group title="Due soon" tasks={board.dueSoon} empty="Nothing due right now." />
      <Group title="Submitted" tasks={board.submitted} empty="You have not submitted anything yet." />
      <Group title="Missed" tasks={board.missed} empty="No missed tasks. Keep it up!" />
    </div>
  );
}
