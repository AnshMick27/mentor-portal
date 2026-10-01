import { formatIst } from "@/lib/dates/ist";

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Calendar day number in India time (IST has no daylight saving), so "today" flips at IST midnight. */
function istDay(time: number): number {
  return Math.floor((time + IST_OFFSET_MS) / DAY_MS);
}

/**
 * A due date students can read at a glance (UX-07): "Due tomorrow (5 Oct 2026, 11:59 pm IST)". Days are counted on
 * the IST calendar; beyond a week, or once past, only the date is shown.
 */
export function dueText(dueIso: string, now: Date): string {
  const due = Date.parse(dueIso);
  const date = formatIst(dueIso);
  if (due < now.getTime()) return `Was due ${date}`;
  const days = istDay(due) - istDay(now.getTime());
  if (days === 0) return `Due today (${date})`;
  if (days === 1) return `Due tomorrow (${date})`;
  if (days < 7) return `Due in ${days} days (${date})`;
  return `Due ${date}`;
}
