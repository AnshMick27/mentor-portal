# LOOP — one iteration builds exactly one task

You are building the CDC Mentor Portal. This file is given to you at the start of every iteration. Follow the steps in order. Do one task, then stop.

## Step 1 — Load context
1. Read `CLAUDE.md`, `SPEC.md`, `PROGRESS.md`, and `NOTES.md` (if it exists).
2. Run `git status` and `git log --oneline -5`.
3. If there are uncommitted changes from an earlier iteration, work out which task they belong to. Finish and verify that task first (it becomes this iteration's task). If you cannot make sense of them, record it under "Blockers" in PROGRESS.md and end with `LOOP_STATUS: BLOCKED`.

## Step 2 — Pick the task
- Take the FIRST unchecked item (`- [ ]`) under "Current loop" in PROGRESS.md.
- If it is marked 🔒 HUMAN: do not do it. Print a short, numbered, beginner-friendly explanation of what Ansh must do, then end with `LOOP_STATUS: HUMAN_CHECKPOINT`.
- If there are no unchecked items: end with `LOOP_STATUS: ALL_DONE`.

## Step 3 — Plan
- Write a plan of at most 10 lines: files to create/change, tests to add, how you will verify the acceptance criteria.
- If the task is clearly too big for one iteration, split it into sub-items (T6a, T6b, ...) in PROGRESS.md, then do only the first one.

## Step 4 — Build
- Implement ONLY this task, following SPEC.md exactly.
- Obey SPEC.md section 7 (security) at all times.
- Small, typed files. No `any`. Validate inputs with zod. Reuse existing helpers instead of duplicating them.
- Add a dependency only if SPEC.md lists it or the task truly needs it; if you add one not in SPEC.md, write why in NOTES.md.

## Step 5 — Verify
- Add or update tests for the acceptance criteria.
- Run `npm run check`. It must pass.
- Exception: if the task in PROGRESS.md says it overrides `npm run check` (setup tasks such as T0), verify every item in its Acceptance list instead.
- If it fails, fix and re-run. After 3 failed fix attempts, stop: record the error and what you tried under "Blockers" in PROGRESS.md, commit nothing broken, and end with `LOOP_STATUS: BLOCKED`.

## Step 6 — Record
- Tick the task in PROGRESS.md (`- [x]`) and add one line to "Done log": date, task id, what was built.
- Add to NOTES.md only genuinely useful gotchas (commands, quirks, decisions) that a future iteration needs. Keep it short.
- If you had to make a decision the spec does not cover, add it under "Questions for Ansh" in PROGRESS.md.

## Step 7 — Commit
- `git add -A` then `git commit -m "<task id>: <short description>"`.
- Confirm with `git status` that no `.env` file or key was committed. Never push; Ansh pushes after review.

## Step 8 — Finish
End your output with exactly one final line:
`LOOP_STATUS: TASK_DONE`

---

## Hard rules (breaking any of these is a failure)
1. Never edit SPEC.md or LOOP.md.
2. Never weaken `firestore.rules`, skip tests, or delete tests to make checks pass.
3. Never put secrets in client code, `NEXT_PUBLIC_` variables, logs, or git.
4. Never mark a task done unless `npm run check` passed in this iteration (or, for setup tasks that override it, every Acceptance item was verified).
5. Never start the next task in the same iteration.
6. Never run destructive commands (deleting folders outside the build output, `git reset --hard`, force pushes).
7. If something in SPEC.md looks wrong, do not silently change the design: follow the spec, and note the concern under "Questions for Ansh".
