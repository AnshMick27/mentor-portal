import type { StudentTask, TaskProgress } from "@/lib/tasks/studentBoard";
import { publishedOnly } from "@/lib/tasks/studentBoard";
import type { StoredStudentStats } from "@/lib/validation/stats";
import { TASK_TYPE_LABEL, TASK_TYPES, type TaskDto, type TaskType } from "@/lib/validation/task";

/** "This week" on the student home screen = due within the next 7 days (SPEC.md §8.5). */
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const DASHBOARD_NEXT_STEPS = 3;

/** Published tasks not yet past due and due within 7 days, soonest first, with the student's progress. */
export function tasksThisWeek(
  tasks: readonly TaskDto[],
  progress: ReadonlyMap<string, TaskProgress>,
  now: Date,
): StudentTask[] {
  const start = now.getTime();
  return publishedOnly([...tasks])
    .filter((task) => {
      const due = Date.parse(task.dueAt);
      return due >= start && due <= start + WEEK_MS;
    })
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
    .map((task) => ({ ...task, ...(progress.get(task.id) ?? { attemptsUsed: 0 }) }));
}

export type SkillAverage = { type: TaskType; label: string; average: number };

/** Averages per skill from the stats doc, in the usual task-type order; skills without a score are left out. */
export function skillAverages(stats: Pick<StoredStudentStats, "avgBySkill"> | undefined): SkillAverage[] {
  if (!stats) return [];
  return TASK_TYPES.flatMap((type) => {
    const average = stats.avgBySkill[type];
    return average === undefined ? [] : [{ type, label: TASK_TYPE_LABEL[type], average }];
  });
}

/** Up to 3 next steps from the latest resume/intro feedback. */
export function dashboardNextSteps(stats: Pick<StoredStudentStats, "latestNextSteps"> | undefined): string[] {
  return (stats?.latestNextSteps ?? []).slice(0, DASHBOARD_NEXT_STEPS);
}
