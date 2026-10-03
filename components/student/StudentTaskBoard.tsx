import { CardLink } from "@/components/ui/Card";
import { dueText } from "@/components/ui/dueText";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatScore } from "@/components/ui/Score";
import { Section } from "@/components/ui/Section";
import { StatusChip } from "@/components/ui/StatusChip";
import type { StudentBoard, StudentTask } from "@/lib/tasks/studentBoard";
import { TASK_TYPE_LABEL } from "@/lib/validation/task";
import { progressText, taskChip } from "./taskStatus";

/** Title with its status chip, then type and relative due date, then progress. */
export function TaskCardBody({ task, now }: { task: StudentTask; now: Date }) {
  const chip = taskChip(task, now);
  return (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 font-semibold break-words">{task.title}</span>
        <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
      </span>
      <span className="text-sm text-muted">
        {TASK_TYPE_LABEL[task.type]} · {dueText(task.dueAt, now)}
      </span>
      <span className="text-sm text-muted">{progressText(task, formatScore)}</span>
    </>
  );
}

function TaskCard({ task, now }: { task: StudentTask; now: Date }) {
  return (
    <li>
      <CardLink href={`/student/tasks/${task.id}`}>
        <TaskCardBody task={task} now={now} />
      </CardLink>
    </li>
  );
}

function Group({ title, tasks, empty, now }: { title: string; tasks: StudentTask[]; empty: string; now: Date }) {
  return (
    <Section title={title} count={tasks.length}>
      {tasks.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} now={now} />
          ))}
        </ul>
      )}
    </Section>
  );
}

export function StudentTaskBoard({ board, now = new Date() }: { board: StudentBoard; now?: Date }) {
  return (
    <div className="flex flex-col gap-8">
      <Group title="Due soon" tasks={board.dueSoon} empty="Nothing due right now." now={now} />
      <Group title="Submitted" tasks={board.submitted} empty="Nothing here yet. A task moves here once it closes or you have used all your attempts." now={now} />
      <Group title="Missed" tasks={board.missed} empty="No missed tasks. Keep it up!" now={now} />
    </div>
  );
}
