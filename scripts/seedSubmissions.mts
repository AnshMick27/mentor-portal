// Demo submissions for the local emulators (T23). Pure, like seedData.mts; imports use `.ts` extensions.
import { codingScore } from "../lib/submissions/scoring.ts";
import type { AiTaskType, Criterion, StoredSubmission, SubmissionResult } from "../lib/validation/submission.ts";
import type { Language, TaskType } from "../lib/validation/task.ts";

/** A submission doc as the seed builds it: a real Date for `createdAt` (seed.mts converts it to a Timestamp). */
export type SeedSubmission = { id: string; doc: Omit<StoredSubmission, "createdAt"> & { createdAt: Date } };

/** One attempt in the demo story: what was sent and how it ended. */
type Attempt =
  | { kind: "ai"; score: number; daysBeforeDue: number }
  | { kind: "code"; passed: number; total: number; verdict: string; daysBeforeDue: number; language?: Language }
  | { kind: "error"; daysBeforeDue: number; message: string };

type SeedTaskRef = { id: string; type: TaskType; dueAt: string };

const DAY = 86_400_000;

const CRITERIA: Record<AiTaskType, string[]> = {
  resume: ["Format and length", "Projects", "Action verbs and quantified results", "Grammar and consistency"],
  intro_written: ["Structure", "Clarity", "Tone", "Relevance to placements"],
  scenario: ["Understanding of the situation", "Approach and reasoning", "Practicality", "Communication"],
};

const CONTENT: Record<TaskType, string> = {
  coding: "a, b = map(int, input().split())\nprint(a + b)\n",
  resume:
    "AARAV SHARMA | aarav@example.com | github.com/aarav\nEDUCATION B.Tech CSE, 2027, CGPA 8.1\n" +
    "PROJECTS Campus canteen app (React, Firebase): cut queue time by 30% for 400 daily users.\nSKILLS C++, Python, SQL, Git",
  intro_written:
    "Good morning. I am a final-year B.Tech student at Acropolis. I enjoy building small web apps and have " +
    "solved over 200 problems on coding platforms. My best project is a canteen ordering app used by 400 " +
    "students a day. I am looking for a role where I can grow as a backend developer and learn from a strong team.",
  scenario:
    "First I would tell my lead about the bug and its impact before the release, then reproduce it, write a fix with " +
    "a test, and ask a teammate to review it. If the fix is risky I would suggest releasing without that feature.",
};

/** Criteria scores spread around the overall score (one decimal, kept inside 0–10). */
function criteria(type: AiTaskType, score: number): Criterion[] {
  const offsets = [0.5, -0.5, 0.3, -0.3];
  return CRITERIA[type].map((name, i) => ({
    name,
    score: Math.min(10, Math.max(0, Math.round((score + (offsets[i] ?? 0)) * 10) / 10)),
    comment: score >= 7 ? "Clear and specific." : "Needs more concrete detail.",
  }));
}

function aiResult(type: AiTaskType, score: number): SubmissionResult {
  const strong = score >= 7;
  return {
    score,
    summary: strong
      ? "A solid draft: specific, well organised and placement-ready with small fixes."
      : "A start, but it needs concrete details and a clearer structure before placements.",
    strengths: strong ? ["Specific project with a measurable result", "Clear, confident tone"] : ["Covers the basics", "Easy to read"],
    improvements: strong
      ? ["Tighten the opening line", "Add one more quantified result"]
      : ["Add numbers to show impact", "Follow greeting → background → skills → projects → goals"],
    nextSteps:
      type === "resume"
        ? ["Rewrite each project line as action + tech + result", "Add your GitHub and LinkedIn links at the top"]
        : ["Practise saying it aloud in under 90 seconds", "End with the role you are aiming for"],
    criteria: criteria(type, score),
  };
}

function codeResult(passed: number, total: number, verdict: string): SubmissionResult {
  const firstFailedTest = verdict === "Accepted" || verdict === "Compilation Error" ? undefined : passed + 1;
  const summary =
    verdict === "Accepted"
      ? `Accepted: all ${total} tests passed.`
      : verdict === "Compilation Error"
        ? "Compilation Error: your code did not compile, so no tests were run."
        : `${verdict} on test ${firstFailedTest}: ${passed} of ${total} tests passed.`;
  return {
    score: codingScore(passed, total),
    summary,
    strengths: [],
    improvements: [],
    nextSteps: [],
    judge: {
      passed,
      total,
      verdict,
      ...(firstFailedTest === undefined ? {} : { firstFailedTest }),
      ...(verdict === "Compilation Error" ? { compileOutput: "main.cpp:3:5: error: expected ';' before 'return'" } : {}),
    },
  };
}

/** Builds the docs for one student's attempts at one task, numbering attempts like the API does (errors reuse a number). */
function attemptsFor(uid: string, task: SeedTaskRef, attempts: Attempt[]): SeedSubmission[] {
  const due = Date.parse(task.dueAt);
  let counted = 0;
  return attempts.map((attempt, i) => {
    const base = {
      taskId: task.id,
      uid,
      type: task.type,
      attempt: counted + 1,
      createdAt: new Date(due - attempt.daysBeforeDue * DAY),
      content: CONTENT[task.type],
    };
    const id = `seed-sub-${uid.replace("seed-student-", "s")}-${task.id.replace("seed-", "")}-${i + 1}`;
    if (attempt.kind === "error") {
      return { id, doc: { ...base, status: "error", error: attempt.message } };
    }
    counted += 1;
    if (attempt.kind === "code") {
      return {
        id,
        doc: { ...base, status: "done", language: attempt.language ?? "python", result: codeResult(attempt.passed, attempt.total, attempt.verdict) },
      };
    }
    if (task.type === "coding") throw new Error(`AI attempt on coding task ${task.id}`);
    return { id, doc: { ...base, status: "done", result: aiResult(task.type, attempt.score) } };
  });
}

const ai = (score: number, daysBeforeDue = 1): Attempt => ({ kind: "ai", score, daysBeforeDue });
const code = (passed: number, verdict: string, daysBeforeDue = 1, total = 10): Attempt => ({
  kind: "code",
  passed,
  total,
  verdict,
  daysBeforeDue,
});
const failed = (daysBeforeDue = 2): Attempt => ({
  kind: "error",
  daysBeforeDue,
  message: "The feedback service is busy right now. This attempt was not counted.",
});

/**
 * The demo story, by student number (seed-student-N): 1 and 2 strong, 3 misses two past-due tasks, 4 averages
 * below 5, 5 has a failed (error) attempt, 6 submits nothing. Task ids are the seed task ids without "seed-".
 */
const STORY: Record<number, Record<string, Attempt[]>> = {
  1: {
    "resume-past": [ai(6.5, 3), ai(8, 2)],
    "sum-past": [code(10, "Accepted")],
    "intro-past": [ai(8.5)],
    "two-sum": [code(10, "Accepted", 6)], // due in 5 days: 6 days before = yesterday
  },
  2: {
    "resume-past": [ai(7.2)],
    "sum-past": [code(6, "Wrong Answer", 2), code(10, "Accepted")],
    "intro-past": [ai(7)],
    "resume-v1": [ai(7.8, 11)], // due in 10 days at 23:59 IST: 11 days before = yesterday 23:59 IST
  },
  3: { "resume-past": [ai(6)] },
  4: {
    "resume-past": [ai(4.2)],
    "sum-past": [code(0, "Compilation Error", 2), code(3, "Wrong Answer")],
    "intro-past": [ai(4.5)],
  },
  5: {
    "resume-past": [failed(), ai(6.8)],
    "sum-past": [code(6, "Time Limit Exceeded")],
    "intro-past": [ai(6)],
  },
  6: {},
};

export function buildSeedSubmissions(tasks: readonly SeedTaskRef[]): SeedSubmission[] {
  const byShortId = new Map(tasks.map((task) => [task.id.replace("seed-", ""), task]));
  return Object.entries(STORY).flatMap(([n, perTask]) =>
    Object.entries(perTask).flatMap(([shortId, attempts]) => {
      const task = byShortId.get(shortId);
      if (!task) throw new Error(`Seed story refers to unknown task ${shortId}`);
      return attemptsFor(`seed-student-${n}`, task, attempts);
    }),
  );
}
