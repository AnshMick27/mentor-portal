// Demo data for the local emulators (T11). Pure: no Firebase calls, so it is unit-tested in tests/scripts/.
// Imports use `.ts` extensions because `node` runs this file directly (native type stripping).
import { initialStudentStats, type StudentStatsFields } from "../lib/stats/initialStudentStats.ts";
import { taskInputSchema, type TaskInput, type ValidTask } from "../lib/validation/task.ts";
import type { Branch, Role, StoredUser } from "../lib/validation/user.ts";

export type SeedUser = { uid: string; doc: StoredUser };
export type SeedData = {
  users: SeedUser[];
  studentStats: { uid: string; doc: StudentStatsFields }[];
  tasks: { id: string; task: ValidTask }[];
};

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const DEFAULT_HOSTS = { firestore: "127.0.0.1:8080", auth: "127.0.0.1:9099" };

/**
 * Where the seed writes. Defaults to the local emulators (ports from firebase.json) and throws if an
 * emulator host variable points anywhere else, so the seed can never touch a real project.
 */
export function emulatorHosts(env: Record<string, string | undefined>): { firestore: string; auth: string } {
  const hosts = {
    firestore: env.FIRESTORE_EMULATOR_HOST?.trim() || DEFAULT_HOSTS.firestore,
    auth: env.FIREBASE_AUTH_EMULATOR_HOST?.trim() || DEFAULT_HOSTS.auth,
  };
  for (const [name, host] of Object.entries(hosts)) {
    const hostname = host.replace(/:\d+$/, "");
    if (!LOCAL_HOSTS.has(hostname)) {
      throw new Error(`Refusing to seed: the ${name} emulator host "${host}" is not on this machine.`);
    }
  }
  return hosts;
}

const STUDENTS: { name: string; branch: Branch; rollNo: string }[] = [
  { name: "Aarav Sharma", branch: "CSE", rollNo: "0827CS231001" },
  { name: "Diya Patel", branch: "IT", rollNo: "0827IT231002" },
  { name: "Kabir Singh", branch: "CSIT", rollNo: "0827CI231003" },
  { name: "Meera Iyer", branch: "CSE-AIML", rollNo: "0827AL231004" },
  { name: "Rohan Verma", branch: "CY", rollNo: "0827CY231005" },
  { name: "Sana Khan", branch: "EC", rollNo: "0827EC231006" },
];

function user(uid: string, name: string, email: string, role: Role, extra: Partial<StoredUser> = {}): SeedUser {
  return { uid, doc: { name, email, role, onboarded: true, showOnLeaderboard: false, ...extra } };
}

/** ISO string `days` from `now`, at 23:59 IST. */
function dueInDays(now: Date, days: number): string {
  const ist = new Date(now.getTime() + 330 * 60_000 + days * 86_400_000);
  return `${ist.toISOString().slice(0, 10)}T23:59:00+05:30`;
}

/** 1 mentor, 1 viewer, 6 onboarded students across branches, 4 tasks (2 published, 1 draft, 1 past due). */
export function buildSeedData(domain: string, now: Date): SeedData {
  const email = (local: string) => `${local}@${domain}`;
  const students = STUDENTS.map((s, i) =>
    user(`seed-student-${i + 1}`, s.name, email(`demo.student${i + 1}`), "student", {
      rollNo: s.rollNo,
      branch: s.branch,
    }),
  );
  const users = [
    user("seed-mentor", "Demo Mentor", email("demo.mentor"), "mentor"),
    user("seed-viewer", "Demo Viewer", email("demo.viewer"), "viewer"),
    ...students,
  ];

  const tasks: { id: string; input: TaskInput }[] = [
    {
      id: "seed-two-sum",
      input: {
        title: "Two Sum",
        type: "coding",
        status: "published",
        dueAt: dueInDays(now, 5),
        description:
          "Given `n` integers and a target, print the **0-based indices** of the two numbers that add up to the target.\n\n" +
          "Input: first line `n target`, second line the `n` integers.",
        coding: {
          problemSlug: "two-sum",
          languages: ["cpp", "java", "python"],
          sampleTests: [
            { input: "4 9\n2 7 11 15", output: "0 1" },
            { input: "3 6\n3 2 4", output: "1 2" },
          ],
          timeLimitMs: 2000,
        },
      },
    },
    {
      id: "seed-resume-v1",
      input: {
        title: "Resume review: first draft",
        type: "resume",
        status: "published",
        dueAt: dueInDays(now, 10),
        description:
          "Upload your resume as a PDF (or paste the text). Keep it to **one page** and lead with projects.\n\n" +
          "- Quantify impact where you can\n- Put links to GitHub and LinkedIn at the top",
      },
    },
    {
      id: "seed-intro-draft",
      input: {
        title: "Tell me about yourself (written)",
        type: "intro_written",
        status: "draft",
        dueAt: dueInDays(now, 14),
        description: "Write the answer you would give in the first minute of an interview (80–250 words).",
      },
    },
    {
      id: "seed-intro-past",
      input: {
        title: "Why this company? (written)",
        type: "intro_written",
        status: "published",
        dueAt: dueInDays(now, -3),
        description: "Pick a company you are targeting and explain in 80–250 words why you want to join it.",
      },
    },
  ];

  return {
    users,
    studentStats: students.map(({ uid, doc }) => ({
      uid,
      doc: initialStudentStats({ name: doc.name, rollNo: doc.rollNo ?? "", branch: doc.branch ?? "OTHER" }),
    })),
    // Validated with the same schema as the API, so seeded tasks are always ones a mentor could create.
    tasks: tasks.map(({ id, input }) => ({ id, task: taskInputSchema.parse(input) })),
  };
}
