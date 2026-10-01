import { formatIstShortDate } from "@/lib/dates/ist";
import type { StoredStudentStats } from "@/lib/validation/stats";
import { TASK_TYPE_LABEL, TASK_TYPES, type TaskType } from "@/lib/validation/task";

/** A line needs two points; with fewer scores the chart shows an empty state instead. */
export const MIN_CHART_SCORES = 2;

/** One x-axis point: a task's best score, keyed by its skill so each skill gets its own line. */
export type ChartPoint = { time: number; label: string; taskId: string } & Partial<Record<TaskType, number>>;

export type ProgressChartData = {
  points: ChartPoint[];
  /** Skills that have at least one point, in task-type order (one line each). */
  skills: { type: TaskType; label: string }[];
  hasChart: boolean;
};

/**
 * Shapes `studentStats.recentScores` (newest first, max 8) for the line chart: oldest first, one point per
 * task, the score stored under the task's skill. Dates are IST calendar days.
 */
export function progressChartData(recentScores: StoredStudentStats["recentScores"] | undefined): ProgressChartData {
  const points = (recentScores ?? [])
    .map((entry): ChartPoint => {
      const time = entry.at.toDate().getTime();
      return { time, label: formatIstShortDate(time), taskId: entry.taskId, [entry.type]: entry.score };
    })
    .sort((a, b) => a.time - b.time || a.taskId.localeCompare(b.taskId));
  const present = new Set(points.flatMap((point) => TASK_TYPES.filter((type) => point[type] !== undefined)));
  return {
    points,
    skills: TASK_TYPES.filter((type) => present.has(type)).map((type) => ({ type, label: TASK_TYPE_LABEL[type] })),
    hasChart: points.length >= MIN_CHART_SCORES,
  };
}

/** Rows for the screen-reader table: date, skill and score of every point, oldest first. */
export function progressRows(data: ProgressChartData): { key: string; date: string; skill: string; score: string }[] {
  return data.points.flatMap((point) =>
    data.skills.flatMap(({ type, label }) => {
      const score = point[type];
      return score === undefined
        ? []
        : [{ key: `${point.taskId}-${type}`, date: point.label, skill: label, score: score.toFixed(1) }];
    }),
  );
}
