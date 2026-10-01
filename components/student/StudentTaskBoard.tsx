import { CardLink } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { formatIst } from "@/lib/dates/ist";
import type { StudentBoard, StudentTask } from "@/lib/tasks/studentBoard";
import { TASK_TYPE_LABEL } from "@/lib/validation/task";

function TaskCard({ task }: { task: StudentTask }) {
  return (
    <li>
      <CardLink href={`/student/tasks/${task.id}`}>
        <span className="font-semibold break-words">{task.title}</span>
        <span className="text-sm opacity-75">
          {TASK_TYPE_LABEL[task.type]} · Due {formatIst(task.dueAt)}
        </span>
        <span className="text-sm opacity-75">
          Attempts: {task.attemptsUsed} of {task.maxAttempts} used
          {task.bestScore !== undefined && <> · Best {task.bestScore.toFixed(1)} / 10</>}
        </span>
      </CardLink>
    </li>
  );
}

function Group({ title, tasks, empty }: { title: string; tasks: StudentTask[]; empty: string }) {
  return (
    <Section title={title} count={tasks.length}>
      {tasks.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </ul>
      )}
    </Section>
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
