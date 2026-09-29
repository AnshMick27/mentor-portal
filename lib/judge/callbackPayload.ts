import { z } from "zod";

/**
 * The judge callback body, exactly as documented in judge-repo/README.md ("Callback contract") and produced by
 * judge-repo/scripts/judge_util.py + the `report` job in judge.yml. Keep all three in sync.
 */

/** Ids the judge accepts and echoes back (Firestore auto-ids are 20 alphanumerics). */
export const SUBMISSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const JUDGE_VERDICTS = [
  "Accepted",
  "Wrong Answer",
  "Time Limit Exceeded",
  "Runtime Error",
  "Compilation Error",
] as const;
export type JudgeVerdict = (typeof JUDGE_VERDICTS)[number];

/** Verdicts that name the first failing test. */
const FAILED_ON_TEST: ReadonlySet<JudgeVerdict> = new Set(["Wrong Answer", "Time Limit Exceeded", "Runtime Error"]);

export const MAX_COMPILE_OUTPUT_CHARS = 4000;
const MAX_ERROR_CHARS = 500;

const submissionId = z.string().regex(SUBMISSION_ID_PATTERN);

const judgeCountsSchema = z
  .strictObject({
    passed: z.number().int().min(0),
    total: z.number().int().min(1),
    verdict: z.enum(JUDGE_VERDICTS),
    firstFailedTest: z.number().int().min(1).optional(),
  })
  .superRefine((judge, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if (judge.passed > judge.total) issue("passed cannot exceed total.");
    if (judge.verdict === "Accepted" && judge.passed !== judge.total) issue("Accepted must pass every test.");
    if (judge.verdict === "Compilation Error" && judge.passed !== 0) issue("A compilation error passes no tests.");
    if (FAILED_ON_TEST.has(judge.verdict)) {
      // The harness stops at the first failure, so every earlier test passed.
      if (judge.firstFailedTest === undefined) issue(`${judge.verdict} needs firstFailedTest.`);
      else if (judge.firstFailedTest > judge.total || judge.firstFailedTest !== judge.passed + 1) {
        issue("firstFailedTest must be passed + 1 and at most total.");
      }
    } else if (judge.firstFailedTest !== undefined) {
      issue(`${judge.verdict} has no failing test.`);
    }
  });

const doneSchema = z
  .strictObject({
    submissionId,
    status: z.literal("done"),
    judge: judgeCountsSchema,
    compileOutput: z.string().max(MAX_COMPILE_OUTPUT_CHARS).optional(),
  })
  .refine(
    (body) => body.compileOutput === undefined || body.judge.verdict === "Compilation Error",
    "compileOutput is only sent with a compilation error.",
  );

const errorSchema = z.strictObject({
  submissionId,
  status: z.literal("error"),
  error: z.string().min(1).max(MAX_ERROR_CHARS),
});

export const judgeCallbackSchema = z.union([doneSchema, errorSchema]);
export type JudgeCallback = z.infer<typeof judgeCallbackSchema>;
