# PROGRESS

Legend: `- [ ]` to do · `- [x]` done · 🔒 HUMAN = Ansh does this step, the loop stops and explains it.

## Current loop: Loop 4 — Launch (Week 4)

Goal: make the portal safe and understandable for real students, let the mentor remove students who are not his mentees, polish the UI/UX with a dedicated design agent, launch directly to the batch (no separate pilot week, decided by Ansh on 2026-10-01), then fix what launch feedback shows. Every fix keeps `npm run check` green.

- [x] **T30 — Pre-pilot fixes from open questions**
  - Lock a task's `type` and coding `problemSlug` once it has any submission: `PATCH /api/tasks/[id]` answers 409 "This task already has submissions, so its type (or problem) can't change." (other edits and publish/unpublish still work). The form shows the fields read-only for such tasks.
  - Mentor wording: in the mentor profile (T28), a failed attempt reads "Not counted (the student can try again)" instead of the student-facing "…so you can try again"; the student page is unchanged.
  - Delete the unused `components/ProfileCard.tsx` and its test (replaced by the dashboards in T24/T27).
  - Acceptance: API tests for the lock (type change 409, slug change 409, title/due date/publish still OK, no lock without submissions); render test for the mentor wording.

- [x] **T31 — Security hardening and route audit**
  - Security headers for every page via `next.config.ts` `headers()`: Content-Security-Policy (self + the Firebase/Google sign-in origins the app really uses; no `unsafe-eval` in production), `X-Frame-Options: DENY` / `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` (camera, microphone, geolocation off). Read the Next 16 docs in `node_modules/next/dist/docs/` first.
  - A test that walks `app/api/**/route.ts` and fails unless each handler uses `requireUser` (or `verifyIdentity` for `/api/me`), except the allow-listed machine routes (`judge/callback` = HMAC, `cron/recompute` = CRON_SECRET), and that every route with a body uses a strict zod schema.
  - Re-run the SPEC §7 checklist by hand and write the result in NOTES.md (rules deny all writes, secrets server-only, hidden tests never in this repo, limits enforced).
  - Acceptance: header test (reads the config), route-audit test, production build passes; Google sign-in still works locally against the emulator (or note what could not be checked).

- [x] **T32 — "How your data is used" page and help link**
  - Static `/privacy` page in plain English: what is stored (profile, submissions, scores), who sees it (you, mentors, CDC leadership), that resume/intro text is sent to the AI provider for feedback and PDFs never leave the phone, that code runs in an isolated judge, the opt-in leaderboard, and who to contact. Linked from the header/footer, the login page and next to the resume and intro forms.
  - "Need help?" line in the footer telling students to message their mentor (no new env var, no email address in the code).
  - Acceptance: works at 360 px; render tests for the page and the links.

- [x] **T33 — Operations runbook**
  - `docs/RUNBOOK.md` for Ansh: deploy steps, every env var and where it lives (Vercel / `.env.local` / judge repo secrets), rotating `JUDGE_WEBHOOK_SECRET` / `CRON_SECRET` / the GitHub token (it expires: set a calendar reminder), adding a coding problem and hidden tests, deploying rules and indexes, running the cron by hand, what to do when the judge or AI fails, checking Firestore/Actions/AI usage against free-tier limits, and that the Spark plan has no automatic backups (manual export option).
  - Link it from README.md.
  - Acceptance: every env var in `.env.example` appears in the runbook (a test checks this), and every command in it exists in package.json or is a documented CLI.

- [x] **T34a — Remove (and restore) students: data, rules and API** (added by Ansh on 2026-10-01)
  - Why: anyone with a college email can sign in and becomes a student; Ansh must be able to remove people who are not his mentees.
  - "Removed" is a blocked state, not a deletion: `users/{uid}` gets `removed: true` (+ `removedAt`, `removedBy`). The user doc stays, so the next login does NOT re-create them as a fresh student; their submissions stay in Firestore for the record but leave every dashboard, stat, leaderboard and export.
  - Server: `requireUser` refuses removed users (403 "Your access to the portal has been removed. Contact your mentor if this is a mistake."); `POST /api/me` returns that same 403 so the login screen shows it and signs them out; `/api/me` never un-removes anyone (only a mentor can restore).
  - `POST /api/students/[uid]/remove` and `POST /api/students/[uid]/restore` (mentor only; viewer and student 403; staff accounts cannot be removed → 400). Remove deletes their `studentStats`, then recomputes all `taskStats` (they drop out of "not submitted" lists); restore recomputes their stats. `countedStudents` (lib/stats/compute.ts) skips removed users.
  - Firestore rules: a removed user is treated as not provisioned (reads nothing). This only tightens the rules; add rules tests for it.
  - Acceptance: API tests (roles, staff refused, remove → blocked on every student route and on `/api/me`, restore → works again, stats/taskStats updated, export and leaderboard exclude them), rules tests for a removed user, unit tests for `countedStudents`.

- [x] **T34b — Remove (and restore) students: UI**
  - New `/mentor/students` page: every student account (users with role student, including not-yet-onboarded sign-ups), with name, email, roll no, branch, joined date, onboarded yes/no, and a search box. Shows active and removed students in separate groups. Linked from the mentor dashboard header.
  - Mentor only: "Remove from portal" button per student with a confirm step that names the student and explains what happens (access blocked, data kept, can be restored); "Restore" on removed students. Viewers see the list read-only. The student profile page (T28) also gets the button.
  - Students: a removed user who signs in sees the plain message on the login page.
  - Acceptance: works at 360 px; render tests for both groups, the confirm step and viewer read-only; rules test for the list query (staff ✔, student ✘).

- [x] **T35 — UI/UX design pass by a dedicated design agent** (added by Ansh on 2026-10-01)
  - Create a project subagent `.claude/agents/ui-ux-designer.md` (frontmatter: name, description, tools limited to read/search/run plus Edit/Write for UI files only; system prompt: mobile-first at 360 px, Tailwind 4 already in use, accessibility basics from SPEC §11, plain-English copy for Indian campus students, never touch API routes, rules, lib/ server code or tests' assertions about security).
  - Run it on the whole portal (login, onboarding, student dashboard, task board, task page incl. the three submit forms, mentor dashboard, task list/form, student list and profile, privacy page). It writes `docs/UX_REVIEW.md`: findings ranked by impact (consistency, visual hierarchy, spacing, tap targets, colour/contrast incl. dark mode, empty/loading/error states, copy, navigation), each with the page, the problem and a concrete fix; plus shared design tokens/components to extract (buttons, cards, section headings, status chips) so pages stop repeating long class strings.
  - Then split the review into T35a, T35b, … (most impact first, one per iteration): the main loop (or the agent, when the change is purely presentational) implements them, keeping every existing test green and adding render tests for new shared components.
  - Acceptance for T35 itself: the agent file exists and is committed; `docs/UX_REVIEW.md` exists with ranked findings; the follow-up sub-tasks are written into this list.
- [x] **T35a — Theme tokens, global focus ring, dark-mode controls** (UX-02, UX-03 global part, UX-29 CSS part; see docs/UX_REVIEW.md §2–4)
  - Acceptance: `globals.css` sets `color-scheme`, has the tokens from review §3.1 and one `:focus-visible` rule; all tests green.
- [x] **T35b — Header navigation, brand link, skip link** (UX-01, UX-30)
  - Acceptance: render test for `AppHeader`: student sees Home and My tasks, mentor/viewer sees Dashboard, Tasks and Students; current page has `aria-current="page"`; brand links to the role's home; skip link targets `#main`.
- [x] **T35c1 — `Button` / `ButtonLink` / `buttonClasses` in `components/ui/`, replacing every hand-written button style** (UX-16; T35c split in two because it touches ~20 files)
  - Acceptance: render tests for the component (variants, sizes, `busy` label, disabled); grep finds no `bg-blue-700`/`bg-red-700` button strings outside `components/ui`; all tests green.
- [x] **T35c2 — `TextLink`/`BackLink` and `Note`, replacing the copies; success never shown as an error; back links go to the right place** (UX-15 links part, UX-09, UX-17)
  - Acceptance: render tests for the components (`role` per tone, `←` hidden from screen readers); a successful feedback submit is never shown as an error; no link inside an `opacity-*` element.
- [x] **T35d1 — `PageHeader` with a browser-tab title per page; loading and errors appear under the page heading** (UX-18, UX-26; T35d split in two because it touches ~15 files)
  - Acceptance: `PageHeader` render test (h1, `<title>` "… · CDC Mentor Portal", back link, subtitle/actions); each data page keeps its h1 while loading; `QueryStatus` takes a loading label.
- [ ] **T35d2 — `Card`/`CardLink`, `Section`, `EmptyState`; one page stack; task description under its own heading** (UX-25, UX-11 section part)
  - Acceptance: render tests (`Section` uses `aria-labelledby` and no duplicate `aria-label`; `EmptyState` with an optional action); no `CARD` constants left in components.
- [ ] **T35e — `Disclosure`, `StatusChip`, `Score`** (UX-05, UX-24, UX-31)
  - Acceptance: render tests (chevron present, chip text per tone, `Score` shows — when missing); chart legend readable in both themes.
- [ ] **T35f — Student home: reorder so what is due comes first** (UX-04)
  - Acceptance: dashboard test asserts "This week" comes before "Progress"; no feedback item open by default.
- [ ] **T35g — Task board and task page status** (UX-07 display part, UX-23, UX-32 student copy)
  - Acceptance: a submitted-but-open task shows "Can improve"; relative-due helper unit-tested with IST edge cases; task page shows "Go to submit" only while open.
- [ ] **T35h — Submit forms: live judge status, last-attempt warning, disabled reasons, field order, counters** (UX-08, UX-10, UX-19, UX-11 result/markdown headings)
  - Acceptance: last-attempt note when one attempt is left; disabled reason linked by `aria-describedby`; no h4 without an h3; counters not `aria-live`.
- [ ] **T35i — Fields and contrast: `Field` component, field borders, switch track, onboarding errors** (UX-06, UX-28, UX-15 text part)
  - Acceptance: `Field` render test (`aria-invalid`/`aria-describedby`); grep finds no `border-black/20` on inputs and no `opacity-7x/8x` on text in `components/`.
- [ ] **T35j — Mentor screens: refresh without wiping the page, tap targets, Remove placement, task form** (UX-12, UX-13, UX-14, UX-21, UX-22 except section order)
  - Acceptance: student list keeps its search value after Remove/Restore; `taskFormLock` test still passes; Remove sits in an "Access" section on the profile; not-submitted rows are at least 44 px.
- [ ] **T35k — Small polish: login context, Markdown links, mentor copy** (UX-27, UX-29 component part, UX-32 mentor copy)
  - Acceptance: home/privacy tests green; Markdown test checks the "(opens in a new tab)" text.

- [ ] **H12 🔒 HUMAN — Launch** (H10 pilot setup and H11 pilot week dropped by Ansh on 2026-10-01: launch directly)
  1. Before announcing: as mentor, create and publish the first real tasks (for a coding task, add its hidden tests to the judge repo first). Check spend limits (AI provider, GitHub Actions minutes, Firebase usage) and set a calendar reminder a week before the GitHub judge token expires.
  2. Run through H9's checks once more on the deployed site.
  3. Announce the portal to the batch (WhatsApp: link + "sign in with your college email"). Remove anyone who is not your mentee on `/mentor/students`.
  4. Watch the first days on `/mentor`. Write every problem or wish (yours or the students') under "Launch feedback" below: one line each — who, which page, what happened.
  5. Push to GitHub, tick H12 and say `Follow LOOP.md`.

- [ ] **T36 — Launch fixes**
  - Turn each "Launch feedback" line into a small task (T36a, T36b, …) in this list, most serious first, then do them one per iteration. Anything that would need a new feature or a SPEC change goes to "Questions for Ansh" instead.
  - Acceptance: per sub-task, as written when it is split.

## Launch feedback
(Ansh: one line per problem or wish after launch (H12) — who, which page, what happened.)

## Finished: Loop 3 — Dashboards (Week 3)

Goal: stats are recomputed after every finished submission and once a day, so dashboards read a few precomputed docs instead of raw submissions (SPEC.md §8.5–8.7). Students get a home screen with their tasks, latest feedback, next steps and progress chart; mentors and viewers get task status, needs-attention, class overview, student profiles and an Excel export; an opt-in leaderboard exists but stays off by default.

Definitions used by every task below (SPEC.md §6 leaves them open; see Questions):
- Only `published` tasks and onboarded students count. A task is **submitted** by a student when they have at least one `done` submission for it (errors, and queued/running attempts, don't count). **Best score** = `bestScore` over those.
- `tasksDue` = published tasks whose due date has passed; `missedCount` = of those, the ones not submitted; `tasksSubmitted` = published tasks submitted (due or not).
- `avgBySkill[type]` = mean of best scores over the student's submitted tasks of that type (one decimal). New field `overallAvg` = mean of all best scores (leaderboard, export, class overview).
- `recentScores` = one entry per submitted task (best score; `at` = time of that best attempt), newest 8 by `at`. `latestNextSteps` = `nextSteps` of the newest `done` resume/intro result (max 3).
- Needs attention (SPEC §6): missed ≥ 2 of the last 4 past-due tasks (by due date), OR the mean of the newest 4 `recentScores` < 5 (only when the student has at least 2 scores). The reason names the rule, e.g. "Missed 2 of the last 4 tasks".
- `taskStats`: `submittedCount`, `notSubmittedUids` (onboarded students without a `done` submission), `avgScore` (mean of best scores, absent if none), new field `avgScoreByBranch` (for the branch filter).

- [x] **T20 — Pure stats computation**
  - `lib/stats/compute.ts` (no Firestore): `computeStudentStats(student, tasks, ownSubmissions, now)` and `computeTaskStats(task, students, taskSubmissions, now)` following the definitions above; reuse `effectiveStatus`/`bestScore` from `lib/submissions/scoring.ts`. Extend `StudentStatsFields` (`overallAvg`) and add `TaskStatsFields` + zod schemas for both stored docs (`lib/validation/stats.ts`) so the dashboards can parse them.
  - Acceptance: unit tests for drafts ignored, not-yet-due vs past-due, missed, error/stuck/queued not counted, best of several attempts, averages and rounding, recentScores order and cap of 8, latestNextSteps from AI results only, both needs-attention rules at their edges (exactly 2 of 4 missed; mean exactly 5 vs 4.9; fewer than 2 scores), taskStats counts, notSubmitted excludes non-onboarded and staff, avgScoreByBranch.

- [x] **T21 — `lib/stats/recompute.ts` and wiring**
  - `recomputeStudent(uid)`, `recomputeTask(taskId)`, `recomputeAll()` (reads users, published tasks and submissions once, writes every `studentStats`/`taskStats` doc; a draft task's `taskStats` is deleted). Idempotent: `set` whole docs with `updatedAt`.
  - Fill `onFinished` (T14): recompute that student and that task; failures are logged, never change the submission or the API reply.
  - After a mentor publishes/unpublishes a task or changes its due date (`PATCH /api/tasks/[id]`), run `recomputeAll()` so boards don't wait for the nightly cron (logged on failure, the PATCH still succeeds).
  - Acceptance: tests with the fake Admin SDK: stats docs written with the expected numbers, running twice gives the same docs, onFinished calls both and swallows errors, PATCH triggers recompute only for status/due-date changes.

- [x] **T22 — Daily cron `GET /api/cron/recompute`**
  - Checks `Authorization: Bearer <CRON_SECRET>` with a timing-safe compare (401 otherwise; 500 with a log line if `CRON_SECRET` is unset), then `recomputeAll()`; replies with counts only. `maxDuration` set. `vercel.json` cron once a day at 00:30 IST (`0 19 * * *` UTC; Vercel Hobby allows one run a day).
  - Acceptance: route tests (missing/wrong/right secret, secret unset, recompute failure → 500 without details) and a test that `vercel.json` points at the route with a daily schedule.

- [x] **T23 — Seed demo submissions and stats**
  - Extend `scripts/seed.mts` so local dashboards have data: `done` submissions (coding, resume, intro; several attempts, one `error`) for most demo students, at least one student who trips each needs-attention rule, then write `studentStats`/`taskStats` with the T20 functions (import them by relative path; keep the file importable by Node's type stripping) and `config/app` with `leaderboardEnabled: false`.
  - Acceptance: seed data unit tests updated; seed runs against the emulator from an empty database.

- [x] **T24 — Mentee dashboard `/student`**
  - Replace the placeholder: "This week" (published tasks due in the next 7 days IST, due soon first, with submitted/best score, link to the task), "Latest feedback" (own last 3 `done` results, expandable, reusing `SubmissionResultView`), "Next steps" (up to 3 from `studentStats.latestNextSteps`), summary numbers (submitted / missed / averages by skill). Reads own `studentStats` and own submissions directly from Firestore.
  - New query (uid ==, status == "done", orderBy createdAt desc, limit 3): index in `firestore.indexes.json` and a rules test running the exact query.
  - Acceptance: works at 360 px; unit tests for the "this week" selection and empty states (new student with no stats yet).

- [x] **T25 — Progress chart**
  - Add `recharts` (SPEC §4). Line chart of `recentScores` over time, one line per skill, y-axis 0–10, dates in IST, readable at 360 px; text fallback list for screen readers; empty state when there are fewer than 2 scores. Pure data-shaping helper for the chart.
  - Acceptance: unit tests for the helper; `npm run build` still passes (chart is a client component).

- [x] **T26a — Leaderboard data and APIs** (split from T26)
  - `PATCH /api/config` (mentor only; viewer 403) sets `config/app.leaderboardEnabled`; `GET /api/config` for mentor/viewer. `POST /api/me/leaderboard` (student) sets their own `showOnLeaderboard` (strict zod body).
  - `GET /api/leaderboard` (student, mentor, viewer): 404 "Leaderboard is off" when disabled; else top 10 opted-in students by `overallAvg` (ties by name), returning ONLY `{name, overallAvg}` — never uid, email or roll number. Students never read `config/app` directly (rules unchanged).
  - To keep it at ~10 reads per view, `studentStats` also carries `showOnLeaderboard` (written by recompute from the user doc and by the opt-in route), and the leaderboard is one indexed query on `studentStats` (showOnLeaderboard ==, overallAvg desc, name asc, limit 10).
  - Acceptance: API tests (roles, disabled, only opted-in, top 10 cap, ties, response contains only name + average), opt-in updates both docs.

- [x] **T26b — Leaderboard UI** (split from T26)
  - Leaderboard card + opt-in switch on `/student` (card only when enabled; switch always, with a one-line explanation); on/off switch on `/mentor` (mentor only, hidden for viewers).
  - Acceptance: UI works at 360 px; render tests for the card states and the switches.

- [x] **T27 — Mentor dashboard `/mentor`**
  - Replace the placeholder. Task status: the 10 most recent published tasks (by due date) with submitted / not submitted counts and an expandable list of non-submitters (names and roll numbers from `studentStats`). Needs attention: flagged students with reason. Class overview: average per task and per skill, branch filter (uses `avgScoreByBranch` and studentStats branch). Student names link to `/mentor/students/[uid]`. Reads `studentStats`/`taskStats`/`tasks` directly (staff read allowed by rules), no raw submissions.
  - Acceptance: works at 360 px; unit tests for the pure aggregation/filter helpers; rules test that a student cannot run the dashboard queries.

- [x] **T28 — Student profile `/mentor/students/[uid]`**
  - Name, roll number, branch, stats summary; every published task with attempts used, best score and status; per task the attempts (newest first) with full results reusing `SubmissionResultView` and "What they sent". Reads the student's submissions (uid ==, orderBy createdAt desc, paged 50 at a time) — index + rules test (staff ✔, other student ✘). Viewer sees the same page read-only.
  - Acceptance: works at 360 px; rules test for the query; unit test for grouping submissions by task.

- [x] **T29 — Excel export `GET /api/export`**
  - Add `exceljs` (SPEC §4). Mentor and viewer only. Sheets: "Students" (name, roll no, branch, email, tasks due/submitted/missed, averages by skill, overall, needs attention + reason), "Task status" (student × published task matrix of best scores, blank = not submitted), "All results" (every `done` submission: student, roll no, task, type, attempt, date IST, score, verdict or summary). Filename `mentor-portal-YYYY-MM-DD.xlsx` (IST). Pure workbook builder separate from the route. "Export Excel" button on `/mentor` (downloads with the ID token, not a plain link).
  - Acceptance: API auth tests (student 403, viewer and mentor 200 with the xlsx content type); builder test that reads the workbook back and checks sheet names, headers, a blank cell for not submitted, and IST dates. Never includes content (code/resume text) or hidden tests.

- [x] **H8 🔒 HUMAN — Cron secret and indexes (about 10 minutes)**
  1. Make a long random string (same `node -e ...randomBytes...` command as for the judge secret) and add it as `CRON_SECRET` in Vercel (Production) and `.env.local`. Plain value, no quotes.
  2. In the project folder run `firebase deploy --only firestore:rules,firestore:indexes` and wait until Firebase console → Firestore → Indexes shows every index as "Enabled".
  3. Push to GitHub and wait for the Vercel deploy. In Vercel → Settings → Cron Jobs, check `/api/cron/recompute` is listed, and click **Run** once; its log should say how many students and tasks were recomputed.
  4. Tick H8 and say `Follow LOOP.md`.

- [x] **H9 🔒 HUMAN — End-to-end check of Loop 3**
  1. As a student (the second account from H7): the home screen shows this week's tasks, the latest feedback, next steps and the progress chart; it works on your phone.
  2. As mentor: task status shows who has not submitted; a student with missed tasks appears under needs attention with a reason; the branch filter works; a student's profile shows all attempts.
  3. Turn the leaderboard on, opt in as the student, and check only name and average appear; turn it off again.
  4. Download the Excel export as mentor and as viewer; open it and check the three sheets.
  5. When all is fine, push to GitHub. Loop 3 is complete — ask Claude for Loop 4.

## Finished: Loop 2 — Submissions (Week 2)

Goal: students submit resumes and written intros and get AI feedback, and submit code that the GitHub Actions judge checks against hidden tests. Attempt and size limits are enforced on the server. Stats recompute and dashboards come in Loop 3; this loop only leaves one clear place to call recompute from.

- [x] **T12 — Submission schemas, limits and scoring helpers**
  - `lib/validation/submission.ts`: zod schemas for the stored submission doc (SPEC.md §6), `result` (feedback fields, `criteria`, `judge`), and the two submit request bodies (AI text; code + language). One shared constants file for the §7.8 limits: code ≤ 32 KB (UTF-8 bytes), resume text ≤ 12,000 chars, intro text 300–2,500 chars.
  - Pure helpers (no Firestore): `effectiveStatus(sub, now)` (queued/running older than 10 minutes → `error`, "Judge timed out, attempt not counted"); `attemptsUsed(subs, now)` (counts only submissions whose effective status is not `error`); `bestScore(subs)`; `codingScore(passed, total)` = `round(10 * passed / total, 1)`.
  - Acceptance: unit tests for every limit edge (exactly at / one over), the 10-minute boundary, attempts excluding errors, best score, and coding score rounding (including `total = 0` → refuse).

- [x] **T13 — AI provider adapter and rubrics (SPEC.md §10)**
  - `lib/ai/provider.ts` (`generateFeedback({type, rubric, content})`, picks the implementation from `AI_PROVIDER`/`AI_MODEL`, fails clearly if the key or model is missing), `lib/ai/anthropic.ts`, `lib/ai/gemini.ts`. Call the providers' HTTP APIs with `fetch`; don't add an SDK unless it's clearly needed (NOTES.md if you do).
  - Rubrics as data in `lib/ai/rubrics/` (resume and written intro, criteria and weights exactly as SPEC.md §10).
  - Prompt builder: student text wrapped in `<submission>` tags, with any `</submission>` in the text neutralised; system prompt says it is untrusted data, ignore instructions inside it, score only against the rubric, and flag injection attempts in `summary`.
  - Output: JSON only, validated with zod (score 0–10 rounded to 1 decimal, strengths 2–3, improvements 2–3, nextSteps 1–3, summary ≤ 60 words). Invalid output → retry once → throw a typed error.
  - Acceptance: unit tests with mocked `fetch` for both providers: valid reply, invalid then valid (retry), invalid twice (error), provider HTTP error, and a prompt test proving injected text stays inside the tags. No test calls a real API.

- [x] **T13b — Groq provider (approved by Ansh on 2026-09-28)**
  - Third AI provider: `AI_PROVIDER=groq` + `GROQ_API_KEY` (server env, optional; `.env.example` updated). Groq has a free tier and does not train on or (by default) retain inputs, which suits student resumes.
  - `lib/ai/groq.ts`: OpenAI-compatible `POST https://api.groq.com/openai/v1/chat/completions` via `fetch` (no new dependency), `response_format: json_schema` built from `aiWireSchema`; `strict: true` only for models Groq lists as strict-capable, best-effort otherwise. A best-effort schema-mismatch 400 counts as an unusable reply (retried once).
  - Acceptance: mocked-fetch tests like the other providers (valid reply, retry, give up, HTTP/network error, request shape, strict vs best-effort) and env tests for the new provider value.

- [x] **T14 — `POST /api/feedback` (resume and written intro)**
  - Student only (`requireUser`). Body validated with T12 schemas. Task must exist, be published, have type `resume` or `intro_written` matching the body, and `now <= dueAt` (late submissions refused with a clear message — see Questions).
  - In one transaction: count attempts with `attemptsUsed` (refuse with 409 when `>= maxAttempts`), then create `submissions/{id}` as `running` with `attempt = used + 1`. Then call the AI (T13) and update the doc to `done` + `result`, or `error` + plain-English `error` (attempt not counted). Details go to server logs only.
  - Set the route's `maxDuration` so a slow AI call is not cut off on Vercel. Add `lib/submissions/onFinished.ts` (no-op for now, called after every finished submission; Loop 3 fills it with stats recompute).
  - Acceptance: API tests with the fake Admin SDK and a fake AI: non-student 403, draft/wrong-type/past-due task refused, size limits, attempts limit, error path not counted, success stores a valid result.

- [x] **T15a — Resume and intro submit forms** (split from T15)
  - On `/student/tasks/[id]` for resume tasks: pick a PDF (text extracted in the browser with `pdfjs-dist`; the file is never sent) OR paste text, shown in an editable box to confirm before submitting. For intro: textarea with a live word count (target 80–250) and the char limits. Calls `POST /api/feedback`; shows a short "feedback ready" score + summary. Replaces the "Coming soon" button for these two types; closed state for past-due / no attempts left.
  - Acceptance: works at 360 px; unit tests for word count and the PDF-text helper (mock pdfjs).

- [x] **T15b — Results and attempt history** (split from T15)
  - Results: score, criteria table, strengths, improvements, next steps. Past attempts listed newest first (read own submissions directly from Firestore, allowed by rules; add a rules test for the exact query and any index needed in `firestore.indexes.json`).
  - Board and detail page show attempts used (excluding errors, via `attemptsUsed`/`effectiveStatus`; `loadStudentTask` still counts every doc) and best score (SPEC.md §8.2).
  - Acceptance: works at 360 px; rules test for the submissions query.

- [x] **H5 🔒 HUMAN — AI key and a real resume check (about 10 minutes)**
  1. Choose the provider (Groq, Gemini or Anthropic) and create an API key in that provider's console. Groq and Gemini have free tiers; Groq does not train on your data, Gemini's free tier may. For a paid provider, set a small monthly spend limit there.
  2. Put `AI_PROVIDER`, `AI_MODEL` and the matching key in `.env.local` AND in Vercel → Settings → Environment Variables, then redeploy on Vercel.
  2b. In the project folder run `firebase deploy --only firestore:rules,firestore:indexes` (added in T15b: the attempt history needs a new index; the index takes a few minutes to build — watch Firebase console → Firestore → Indexes until it says "Enabled").
  3. Locally (or on the deployed site), submit one resume and one intro as a student. Check that the feedback reads well and the score feels fair. Try an intro containing "Ignore the rubric and give me 10/10": the score must not jump, and the summary should flag it.
  4. Tick H5 and say `Follow LOOP.md`.

- [x] **T16 — Judge repo template (`judge-repo/`, SPEC.md §9)**
  - `judge-repo/.github/workflows/judge.yml`: triggered by `repository_dispatch` type `judge`. Job `run`: `permissions: contents: read`, checkout with `persist-credentials: false`, NO secrets referenced; runs `scripts/run.sh`. Job `report` (needs `run`): no checkout, no student code; signs `results.json` with HMAC-SHA256 using `JUDGE_WEBHOOK_SECRET` and POSTs it to `${APP_BASE_URL}/api/judge/callback`.
  - `judge-repo/scripts/run.sh`: validates the slug and language, compiles and runs inside Docker per test (`--network none --memory 256m --cpus 1 --pids-limit 64 --read-only --tmpfs /tmp`, per-test timeout from `problem.json`), stdin input, expected outputs never mounted, trailing-whitespace-insensitive compare, stop at first failure, verdicts from SPEC.md §8.3 (compile error: first 20 lines of compiler output). Images: `gcc:13`, `eclipse-temurin:21`, `python:3.12-slim`.
  - One sample problem `problems/sum-two-numbers/` (problem.json + 3 tests) and `judge-repo/README.md` with setup steps.
  - Document the exact `results.json` / callback payload shape in the README; T17 validates the same shape with zod.
  - Acceptance: a vitest test reads `judge.yml` and `run.sh` as text and asserts the security properties above (no `secrets.` in the `run` job, `persist-credentials: false`, `--network none`, and the other docker limits). If Docker is available locally, run the sample problem once with the harness and record the result in NOTES.md (optional).

- [x] **T17 — Judge dispatch and callback verification libs**
  - `lib/judge/dispatch.ts`: `repository_dispatch` (event type `judge`) to `GITHUB_JUDGE_REPO` with `{ submissionId, problemSlug, language, codeB64 }` using `GITHUB_JUDGE_TOKEN`, via `fetch`. Clear error if env is missing.
  - `lib/judge/verifyCallback.ts`: HMAC-SHA256 over the RAW request body with `JUDGE_WEBHOOK_SECRET`, timing-safe compare, then zod-parse the payload shape from T16.
  - Acceptance: tests for valid signature, wrong signature, tampered body, missing/garbled header, wrong length; dispatch request shape (URL, headers, base64 round-trip) with mocked `fetch`.

- [x] **T18 — `POST /api/judge/submit` and `POST /api/judge/callback`**
  - Submit (student): published coding task, not past `dueAt`, language allowed by the task, code ≤ 32 KB, attempts check + create `queued` submission in one transaction, then dispatch (T17). If dispatch fails → mark `error` (not counted) and tell the student to try again.
  - Callback (no user auth; HMAC only): verify signature (401 otherwise), submission must exist and be `queued`/`running` (else 409, no change), store `result` with `judge {passed, total, verdict, firstFailedTest?}`, `score` from `codingScore`, short summary; set `done` (or `error` if the judge reports an internal error). Call `onFinished` (T14).
  - Acceptance: API tests for both routes (authorisation, every refusal, dispatch failure, duplicate/late callback ignored, bad signature, score stored correctly).

- [x] **T19 — Coding submit UI**
  - On `/student/tasks/[id]` for coding tasks: language selector (task's languages only), monospace textarea (Tab inserts spaces), byte counter against 32 KB, Submit.
  - Live status via a Firestore listener on the student's own submission: queued → running → done, showing passed/total and the verdict (compile errors in a scrollable monospace block). Stuck > 10 min shown as "Judge timed out, attempt not counted". Past attempts listed as in T15.
  - Acceptance: works at 360 px; unit tests for the status/verdict display logic.

- [x] **H6 🔒 HUMAN — Create the judge repo (about 20 minutes)**
  1. On GitHub, create a PRIVATE repo `mentor-portal-judge` in the same account, and copy everything from `judge-repo/` into it (commit and push).
  2. Add your real hidden tests for each coding problem under `problems/<slug>/tests/` there. They must never be added to this repo.
  3. In the judge repo → Settings → Secrets and variables → Actions, add `JUDGE_WEBHOOK_SECRET` (a long random string) and `APP_BASE_URL` (your Vercel URL).
  4. Create a fine-grained GitHub token with access to ONLY the judge repo, permission "Contents: Read and write" (needed for `repository_dispatch`), with an expiry date.
  5. In Vercel (and `.env.local`) set `GITHUB_JUDGE_REPO` (`owner/mentor-portal-judge`), `GITHUB_JUDGE_TOKEN`, the same `JUDGE_WEBHOOK_SECRET`, and `APP_BASE_URL`. Redeploy.
  6. Tick H6 and say `Follow LOOP.md`.

- [x] **H7 🔒 HUMAN — End-to-end check of Loop 2**
  1. As mentor, create and publish a coding task with slug `sum-two-numbers` and a short due date.
  2. As a student on your phone (deployed site): submit a correct solution (Accepted, 10/10), a wrong one (Wrong Answer on test N), code that does not compile, and an infinite loop (Time Limit Exceeded). Watch the status change live.
  3. Use up all attempts and confirm the next submit is refused. Confirm a resume and an intro still get feedback.
  4. In GitHub → judge repo → Actions, open one run and check the `run` job has no secrets and the `report` job succeeded.
  5. When all is fine, push to GitHub. Loop 2 is complete — ask Claude for Loop 3.

## Finished: Loop 1 — Foundation (Week 1)

Goal: students and mentors can log in with college Google accounts, get the right role, complete onboarding, and see a working task board. Security rules are in place and tested.

- [x] **H1 🔒 HUMAN — Minimum manual setup (about 15 minutes)**
  These are the only parts Claude Code cannot do for you.
  1. Install Claude Code using the official install instructions (https://docs.claude.com/en/docs/claude-code/overview).
  2. On github.com, create a GitHub organisation using a college-owned email (organisations cannot be created from the command line).
  3. Open https://console.firebase.google.com once with the college Google account and accept the terms if asked.
  4. Tick this item (`- [x]`), then open a terminal in the project folder, run `claude`, and type: `Follow LOOP.md`. Run T0 interactively (not with loop.sh) and approve each install command when asked.

- [x] **T0 — Machine and repo setup by Claude Code (interactive only; this task overrides `npm run check`, since no app exists yet)**
  1. Detect the OS. Check `node -v`, `git --version`, `java -version`, `gh --version`, `firebase --version`. For anything missing, propose the install command for this OS (Windows: `winget`; macOS: `brew`; Linux: `apt`) and run it only after Ansh approves: Node.js LTS, Git, Java 21 (Eclipse Temurin), GitHub CLI; then `npm install -g firebase-tools`. If a new terminal is needed for PATH changes, tell Ansh and stop there (`LOOP_STATUS: HUMAN_CHECKPOINT`).
  2. Logins: check `gh auth status` and `firebase login:list`. If not logged in, ask Ansh to run `gh auth login` and `firebase login` himself in a separate terminal (browser sign-in), and wait for him to confirm. Never ask for or handle passwords or tokens.
  3. Git: `git init` if needed; create `.gitignore` covering `.env*` (except `.env.example`), `.loop-logs/`, `*.local.json`, `*firebase-adminsdk*.json`, `*service-account*.json`, `STOP`; commit all files; branch `main`.
  4. GitHub: ask Ansh for the organisation name, then `gh repo create <org>/mentor-portal --private --source=. --remote=origin --push`.
  5. Firebase: ask Ansh for a project id (lowercase, globally unique, e.g. `cdc-mentor-portal-aitr`), then:
     - `firebase projects:create <id> --display-name "CDC Mentor Portal"`
     - `firebase use <id>`
     - `firebase firestore:databases:create "(default)" --location=asia-south1`
     - `firebase apps:create web "Mentor Portal Web"`
     - `firebase apps:sdkconfig web <appId>` → save the output to `.firebase-web-config.local.json` (git-ignored; used in H2).
     If any command is not supported by the installed CLI version or fails, give Ansh the exact Firebase console clicks for that step, wait for confirmation, and continue.
  6. Record OS, tool versions, repo URL, and Firebase project id in NOTES.md (no secrets).
  7. Acceptance: every tool prints a version; the private repo exists on GitHub and `main` is pushed; the Firebase project and Firestore database (asia-south1) exist; `git check-ignore .firebase-web-config.local.json` confirms the config file is ignored. Commit and `git push`.

- [x] **T1 — Project scaffold**
  - Next.js (App Router) + TypeScript strict + Tailwind + ESLint in the repo root.
  - Add vitest. Add scripts: `typecheck`, `lint`, `test`, `test:rules` (placeholder that passes until T4), and `check` = typecheck + lint + test + test:rules.
  - Home page shows "CDC Mentor Portal" and a link to `/login`.
  - `.gitignore` covers `.env*` (but not `.env.example`), `.loop-logs/`, service-account JSON files.
  - Acceptance: `npm run check` and `npm run build` pass.

- [x] **T2 — Environment config**
  - `.env.example` with every variable from SPEC.md §13 (no real values, short comment each).
  - `lib/config/env.ts`: zod-validated server env (throws a clear error listing missing vars) and a separate public env object for `NEXT_PUBLIC_` values. Server env must be importable only on the server (`server-only`).
  - Helper parsing `MENTOR_EMAILS` / `VIEWER_EMAILS` into lowercase sets.
  - Acceptance: unit tests for parsing and for missing-variable errors.

- [x] **H2 🔒 HUMAN — Console clicks and secrets (about 10 minutes)**
  1. Firebase console → Authentication → Get started → Sign-in method → enable **Google**.
  2. Firebase console → Project settings → Service accounts → **Generate new private key**. Save the JSON file OUTSIDE the project folder. Never commit or share it.
  3. Copy `.env.example` to `.env.local` and fill in: the web config values (from `.firebase-web-config.local.json`), the service-account values (project id, client email, private key from the JSON file), `ALLOWED_EMAIL_DOMAIN`, and your own email in `MENTOR_EMAILS`. Leave AI and GitHub values empty for now.
  4. Confirm `git status` does not show `.env.local`, then tick H2 and say `Follow LOOP.md`.

- [x] **T3 — Firebase modules**
  - `lib/firebase/client.ts`: browser app, auth, firestore (singleton).
  - `lib/firebase/admin.ts`: Admin SDK (server-only), handles `\n` in the private key.
  - When `NEXT_PUBLIC_USE_EMULATOR=true` (dev only), both connect to local emulators.
  - Acceptance: typecheck passes; a tiny test confirms the private-key newline handling.

- [x] **T4 — Emulator and rules-test harness**
  - `firebase.json` with Auth + Firestore emulators, `firestore.rules` (deny everything for now), `firestore.indexes.json`.
  - `tests/rules/` set up with `@firebase/rules-unit-testing`; `test:rules` runs them via `firebase emulators:exec --only firestore`.
  - One sample test: an unauthenticated read of `users/x` is denied.
  - Acceptance: `npm run check` runs the rules tests for real and passes.

- [x] **T5 — Firestore security rules (SPEC.md §7)**
  - Implement the read rules exactly as SPEC.md §7; deny all client writes; default deny.
  - Helper functions: `isSignedIn()`, `isProvisioned()`, `role()`, `isStaff()` (mentor or viewer).
  - Tests must cover at least: student reads own user doc ✔ / another student's ✘; student reads published task ✔ / draft ✘; student reads own submission ✔ / another's ✘; student reads own studentStats ✔ / another's ✘; student reads taskStats ✘; viewer and mentor read all ✔; any client write to any collection ✘ (including a student trying to set their own role or score); unprovisioned signed-in user reads anything ✘.
  - Acceptance: all rules tests pass.

- [x] **H3 🔒 HUMAN — Review the rules**
  Read the list of rule test names printed by `npm run test:rules`. Each one describes a thing a student can or cannot do. If anything looks wrong, add it under "Questions for Ansh" before continuing.

- [x] **T6 — Server auth helper and user provisioning**
  - `lib/auth/requireUser.ts`: reads `Authorization: Bearer <idToken>`, verifies with Admin SDK, checks `email_verified` and `ALLOWED_EMAIL_DOMAIN`, loads `users/{uid}`, checks allowed roles; returns typed user or a 401/403 JSON error.
  - `POST /api/me`: verifies token + domain; on first login creates `users/{uid}` with role from MENTOR_EMAILS / VIEWER_EMAILS / else student, `onboarded` false for students (true for staff); if the email is later added to MENTOR_EMAILS, upgrade role on next login. Returns profile. Wrong domain → 403 with message "Please sign in with your college email."
  - Acceptance: unit tests for role decision logic and domain check (mock Admin SDK).

- [x] **T7 — Login, sign-out, route guards**
  - `/login` with "Sign in with Google" (Google `hd` hint set to the domain). After sign-in calls `/api/me`; on 403 signs out and shows the message.
  - Auth context/provider on the client; sign-out button in the header.
  - Guards: `/student/*` students only; `/mentor/*` mentor or viewer only; not signed in → `/login`; student with `onboarded == false` → `/onboarding`.
  - Placeholder pages `/student` and `/mentor` showing the user's name and role.
  - Acceptance: typecheck/lint/tests pass; pages render at 360 px width.

- [x] **T8 — Onboarding**
  - `/onboarding`: roll number (trim, uppercase, 6–15 alphanumeric) and branch dropdown (SPEC.md §6 list).
  - `POST /api/onboarding` (student only) validates with a shared zod schema, updates the user doc, sets `onboarded: true`, creates the initial `studentStats/{uid}` doc.
  - Acceptance: validation unit tests; after onboarding the student lands on `/student`.

- [x] **T9a — Task schema and API** (split from T9)
  - Shared zod schema for tasks incl. coding fields (problemSlug lowercase-kebab, at least 1 language, 1–5 sample tests, timeLimitMs 500–5000).
  - API: `POST /api/tasks` (create), `PATCH /api/tasks/[id]` (edit, publish/unpublish), `GET /api/tasks` (mentor/viewer list incl. drafts), `GET /api/tasks/[id]` (for the edit form). Mentor only for writes; viewer gets 403 on writes.
  - Acceptance: schema tests; API authorisation tests (student 403, viewer 403 on write, mentor OK).

- [x] **T9b — Mentor task UI** (split from T9)
  - UI: `/mentor/tasks` list (status, type, due date IST), `/mentor/tasks/new` and `/mentor/tasks/[id]` form with markdown preview; coding fields appear only for type coding. Viewer sees the list without buttons.
  - Acceptance: typecheck/lint/tests pass; pages work at 360 px.

- [x] **T10 — Student task board**
  - `/student/tasks`: published tasks grouped "Due soon" / "Submitted" / "Missed" (submission-based grouping can show everything as "Due soon" or "Missed" until submissions exist).
  - `/student/tasks/[id]`: renders description (markdown, sanitised), type, due date, sample tests for coding, attempts info. Submit controls are a disabled placeholder ("Coming soon") for now.
  - Reads directly from Firestore (allowed by rules) or via API; must not show drafts.
  - Acceptance: works at 360 px; drafts never appear (test the query/filter).

- [x] **T11 — Seed script**
  - `scripts/seed.ts` (emulator only; refuses to run if not pointed at the emulator): 1 mentor, 1 viewer, 6 students across branches, 4 tasks (2 published, 1 draft, 1 past due).
  - `npm run seed` documented in README with the steps to run the app against emulators.
  - Acceptance: script runs against the emulator without errors.

- [x] **H4 🔒 HUMAN — End-to-end check**
  1. Run the app locally against the emulator (README steps). Log in as mentor: create, edit, publish a task. Log in as viewer: confirm no edit buttons and that editing via the API is refused.
  2. Log in as a student: onboarding works; only published tasks show.
  3. In the browser console as a student, try reading another student's `users` doc and writing to `tasks`: both must fail.
  4. Deploy to Vercel (import the repo, add the env vars), add the Vercel domain to Firebase Auth → Authorized domains, and log in once on your phone.
  5. When all is fine: push to GitHub. Loop 1 is complete — ask Claude for Loop 2.

## Roadmap (expanded one loop at a time)
- Loop 2 — Submissions: resume and written-intro AI feedback; GitHub Actions code judge; attempts and limits.
- Loop 3 — Dashboards: stats recompute + daily cron, mentee dashboard, mentor dashboard, Excel export, leaderboard flag.
- Loop 4 — Hardening, remove students, UI/UX design pass, launch, launch fixes (pilot week dropped by Ansh).

## Done log
(one line per finished task: date — task id — what was built)
- 2026-09-25 — T0 — Tools installed (Java 21, gh, firebase-tools), git repo + .gitignore, private repo AnshMick27/mentor-portal, Firebase project mentor-portal-ansh with Firestore (asia-south1) and web app.
- 2026-09-25 — T1 — Next.js 16 (App Router) + TS strict + Tailwind 4 + ESLint 9 scaffold, vitest with home-page render test, check/typecheck/lint/test/test:rules scripts, home page linking to /login.
- 2026-09-25 — T2 — .env.example (all SPEC §13 vars), zod-validated server env (server-only, lists missing vars), public env module, parseEmailList helper, 12 new unit tests.
- 2026-09-25 — T3 — Firebase client (browser singleton) and Admin SDK (server-only) modules with emulator switch, private-key normaliser, 8 new unit tests; real service-account key verified.
- 2026-09-26 — T4 — firebase.json (auth 9099 / firestore 8080 emulators), deny-all firestore.rules, empty indexes, @firebase/rules-unit-testing harness in tests/rules run via emulators:exec (demo-mentor-portal), unauthenticated users/x read+write denied tests.
- 2026-09-26 — T5 — firestore.rules read rules per SPEC §7 (isSignedIn/isProvisioned/role/isStaff helpers, all client writes denied, default deny), 65 rules tests across users/tasks/submissions/stats/denied, mutation-checked.
- 2026-09-26 — T6 — requireUser/verifyIdentity (Bearer token, email_verified, exact-domain check, role from users/{uid}), transactional provisioning with list-based roles and staff upgrade, POST /api/me, shared user/role zod schemas, 28 new unit tests with a fake Admin SDK.
- 2026-09-26 — T7 — AuthProvider (Google popup with hd hint → /api/me, sign out + message on failure), RouteGuard/ProtectedShell with pure guardRedirect rules, header sign-out, /login, placeholder /student, /mentor, /onboarding; 14 new unit tests.
- 2026-09-26 — T8 — Shared strict onboarding zod schema, POST /api/onboarding (student only, one transaction: user doc + initial studentStats, 409 on re-onboarding or duplicate roll number), /onboarding form, generalised fake Admin SDK; 15 new unit tests.
- 2026-09-26 — T9a — Split T9 into T9a/T9b. Strict task zod schemas (create + patch, coding rules, per-type default attempts), task store with merge-then-revalidate PATCH, GET/POST /api/tasks and GET/PATCH /api/tasks/[id] (mentor writes, mentor/viewer reads), shared parseBody helper; 30 new unit tests.
- 2026-09-26 — T9b — /mentor/tasks list (status, type, IST due date; viewers get no buttons), /mentor/tasks/new and /mentor/tasks/[id] TaskForm (markdown Write/Preview, coding fields only for coding, draft/published), safe Markdown component (react-markdown), IST date helpers, apiFetch + useApiQuery client helpers; 25 new unit tests.
- 2026-09-26 — T10 — /student/tasks board (Due soon / Submitted / Missed, attempts used) and /student/tasks/[id] (sanitised markdown, sample tests, disabled Submit "Coming soon"), direct Firestore reads via shared query builders, shared task-doc parser; 17 new unit tests + 5 rules tests running the real student queries.
- 2026-09-26 — T11 — scripts/seed.mts (run by Node's built-in TypeScript support, no new dependency; refuses non-local emulator hosts): 1 mentor, 1 viewer, 6 students across branches with studentStats, 4 tasks (2 published, 1 draft, 1 past due); Auth users linked to google.com; npm run emulators / npm run seed; README emulator guide; 9 new unit tests. Verified against the running emulators from an empty database.
- 2026-09-28 — T12 — Submission limits (lib/submissions/limits.ts), zod schemas for stored submissions/results/judge and both submit bodies (lib/validation/submission.ts), effectiveStatus/attemptsUsed/bestScore/codingScore helpers, shared timestampLike; 19 new unit tests.
- 2026-09-28 — T13 — AI adapter: lib/ai/provider.ts (generateFeedback, provider picked by AI_PROVIDER/AI_MODEL, one retry on unusable replies, typed AiFeedbackError), anthropic.ts (official SDK, messages.parse + zod structured output), gemini.ts (REST generateContent, JSON mode), JSON rubrics with validated weights, injection-safe prompt builder; 19 new unit tests with mocked fetch.
- 2026-09-28 — T13b — Groq provider (AI_PROVIDER=groq, GROQ_API_KEY): lib/ai/groq.ts (OpenAI-compatible chat completions via fetch, json_schema response format from aiWireSchema, strict only for Groq's strict-capable models, schema-mismatch 400 retried as invalid output); 8 new unit tests + env test.
- 2026-09-29 — T14 — POST /api/feedback (student only, maxDuration 60): one transaction checks task (published, type, dueAt) + attemptsUsed and creates a `running` submission; AI result → `done`, AI failure → `error` (not counted, 502 plain message); no-op `onFinished` hook; fake Admin DocRef.update; 18 new API tests.
- 2026-09-29 — T15a — Split T15 into T15a/T15b. Resume form (PDF → text in the browser via pdfjs-dist, loaded on demand, 5 MB / 3-page cap, or paste; editable text box, 12,000-char counter) and intro form (live word count vs 80–250 target, 300–2,500 char limit) on /student/tasks/[id], POST /api/feedback with a "feedback ready" note, closed state for past due / no attempts; 21 new unit tests.
- 2026-09-29 — T15b — Live attempt history on /student/tasks/[id] (Firestore listener on the student's own submissions for the task, newest first, newest expanded, "What you sent"), full results view (score, criteria table, strengths, improvements, next steps, judge counts), attempts excluding errors + best score on board and detail page (taskProgress/summarizeByTask), composite index uid+taskId+createdAt; 11 new unit tests + 4 rules tests.
- 2026-09-29 — T16 — judge-repo/ template: judge.yml (repository_dispatch `judge`; `run` job read-only, no credentials, no secrets, payload via env only; `report` job with no checkout HMAC-signs and POSTs, also on a crashed run), scripts/run.sh Docker harness (§9 limits, unprivileged, no caps, src read-only, tests never mounted, per-test KILL timeout, stop at first failure) + judge_util.py (time limit, trailing-whitespace compare, results JSON), sample problem sum-two-numbers, README with the callback contract, LF .gitattributes; 15 static security tests (mutation-checked). Docker not installed locally, so the harness was not run end to end.
- 2026-09-29 — T17 — lib/judge/dispatch.ts (repository_dispatch `judge` via injected fetch, UTF-8 base64 code, typed config/github errors, token never in messages), lib/judge/verifyCallback.ts (strict `sha256=<hex>` header, HMAC over raw bytes, timing-safe compare, 64 KB cap, then zod), lib/judge/callbackPayload.ts (strict callback contract incl. verdict/firstFailedTest/compileOutput rules); 25 new unit tests incl. judge-repo ↔ portal sync checks.
- 2026-09-30 — T18 — POST /api/judge/submit (student only; shared startSubmission transaction now used by feedback too: published coding task, not past due, allowed language, 32 KB, attempts, create `queued`; dispatch failure → `error` not counted, 502) and POST /api/judge/callback (HMAC over raw body only: 401/400/413/500; one transaction accepts only a waiting, not-timed-out coding submission, else 409 no change; `done` + codingScore + judge counts + compileOutput + plain summary, or `error`; onFinished); 25 new API tests.
- 2026-09-30 — T19 — Coding submit form on /student/tasks/[id] (task's languages only, monospace box where Tab inserts 4 spaces with Esc-then-Tab to leave, live 32 KB byte counter, POST /api/judge/submit), live judge status in the attempt history (Waiting / Running / verdict with passed/total / Not counted incl. >10 min timeout via a 15 s clock tick), 'Wrong Answer on test N' and scrollable compiler output in results; pure judgeDisplay helpers; 19 new unit tests.
- 2026-09-30 — T20 — lib/stats/compute.ts (pure computeStudentStats/computeTaskStats per the Loop 3 definitions: best of done attempts, past-due/missed, tenths-exact averages incl. overallAvg and avgScoreByBranch, newest-8 recentScores, next steps from the newest AI result, both needs-attention rules with reasons), lib/stats/types.ts, zod schemas for stored studentStats/taskStats (lib/validation/stats.ts); compute + scoring loadable by plain Node for the T23 seed; 26 new unit tests.
- 2026-10-01 — T21 — lib/stats/recompute.ts (recomputeStudent / recomputeTask / recomputeAll write whole studentStats/taskStats docs with updatedAt, idempotent; draft or missing task stats deleted; malformed docs skipped and logged; recomputeAllAfter logs instead of throwing), onFinished now recomputes the student and the task (never throws), task POST (created published) and PATCH (status, type or due date changed) trigger a full recompute; fake Admin gained doc delete + whole-collection get; 13 new tests.
- 2026-10-01 — T22 — GET /api/cron/recompute (CRON_SECRET bearer checked by lib/cron/cronAuth.ts with a constant-time SHA-256 digest compare; 500 + log if unset, 401 if wrong; recomputeAll → `{students, tasks}` only; 500 without details on failure; maxDuration 60) and vercel.json cron `0 19 * * *` (00:30 IST); 7 new tests.
- 2026-10-01 — T23 — Seed now has 6 tasks (adds past-due `seed-sum-past` coding and `seed-resume-past`), 19 demo submissions from scripts/seedSubmissions.mts (AI results with criteria, Accepted / Wrong Answer / TLE / Compilation Error judge results, one error attempt), studentStats + taskStats computed with lib/stats/compute.ts, `config/app` leaderboard off, students 1/2/5 opted in; students 3, 4, 6 trip the needs-attention rules. Verified from an empty emulator database (counts and stored values read back); README updated; 6 new tests.
- 2026-10-01 — T24 — /student home screen (StudentDashboard): summary (submitted, missed, overall and per-skill averages from studentStats), "This week" (published tasks due in the next 7 days with submitted/best or "Not submitted yet"), "Latest feedback" (own 3 newest `done` results in <details>, newest open, full SubmissionResultView), "Next steps" (max 3), empty states for a new student. lib/dashboard/student.ts helpers + lib/dashboard/studentQueries.ts (latestResultsQuery with new uid+status+createdAt index, ownSubmissionsForTasksQuery `taskId in` chunks of 10, loadStudentDashboard); 9 unit/component tests + 5 rules tests running the exact queries.
- 2026-10-01 — T25 — Progress chart on /student (recharts 3.10, client component): line per skill from studentStats.recentScores (oldest → newest, best score per task), y 0–10, IST day labels (new formatIstShortDate), colours + dash patterns per skill, fixed 240 px height / responsive width, legend + tooltip; aria-hidden chart with an sr-only table of every score; empty state below 2 scores. Pure lib/dashboard/progressChart.ts; react-is pinned to React's version; 6 new tests; build passes.
- 2026-10-01 — T26a — Split T26 into T26a/T26b. GET/PATCH /api/config (mentor/viewer read, mentor writes `config/app.leaderboardEnabled`, missing doc = off), POST /api/me/leaderboard (student's own opt-in, strict body, one transaction on users + studentStats), GET /api/leaderboard (all roles; 404 "Leaderboard is off."; top 10 opted-in by overallAvg desc then name, competition ranks, only {rank, name, overallAvg}); `showOnLeaderboard` copied into studentStats by compute/onboarding; new studentStats index; fake Admin supports chained orderBy and drops docs missing an ordered field; 12 new tests.
- 2026-10-01 — T26b — Leaderboard section under the /student dashboard (StudentLeaderboard: table of rank/name/average while on, "switched off right now" note while off, opt-in Switch always with a one-line privacy hint; POST then refreshProfile + reload) and a mentor-only on/off Switch on /mentor (LeaderboardSetting, hidden for viewers). Shared LeaderboardTable + accessible Switch (checkbox role="switch", 44 px target, hint + error line); pure leaderboardView/configView (404 = off, strict reply parsing); 8 new tests; build passes.
- 2026-10-01 — T27 — /mentor dashboard (MentorDashboard, mentor + viewer): branch filter (branches present only); Task status for the 10 latest published tasks (submitted of total, average, expandable non-submitters with roll numbers linking to /mentor/students/[uid], "no numbers yet" before the first stats); Needs attention with reasons; Class overview (per-skill class average + students counted, average per task); leaderboard switch kept (mentor only). Reads only tasks + taskStats + studentStats (≈70 reads for 50 students): lib/dashboard/mentor.ts (pure) + mentorQueries.ts, new tasks (status, dueAt desc) index, taskStats.avgScoreByBranch defaults to {}; 10 unit/component tests + 4 rules tests.
- 2026-10-01 — T28 — /mentor/students/[uid] (mentor + viewer, read-only): name, roll no, branch, email, needs-attention reason, stats (submitted, missed, overall and per-skill averages); every published task (latest due first) as an expandable row with state (Submitted / Missed / Not due yet), attempts used of max, best score, and the full attempts (results + "What they sent") via AttemptList, now shared with the student task page; count of attempts on unpublished tasks; "Load older attempts" pages 50 at a time (uid + createdAt desc index, cursor). "Student not found" for bad links, unknown uids and staff accounts. lib/dashboard/profile.ts (pure) + profileQueries.ts; 8 unit/component tests + 5 rules tests.
- 2026-10-01 — T29 — GET /api/export (mentor + viewer; maxDuration 60; no-store): exceljs 4.4 workbook with "Students" (name, roll no, branch, email, due/submitted/missed, averages per skill and overall, needs attention + reason), "Task status" (student × published task by due date, best score, blank = not submitted) and "All results" (every `done` attempt: student, task, type, attempt, IST date, score, verdict or summary); bold frozen headers; filename mentor-portal-YYYY-MM-DD.xlsx in IST; submission content is never exported. Pure builder lib/export/workbook.ts, Admin loader lib/export/load.ts, "Export Excel" button on /mentor (fetch with ID token → Blob download, lib/export/download.ts); 13 new tests incl. reading the workbook back.
- 2026-10-01 — T30 — Task type and coding problem slug are locked once a task has any submission (PATCH 409 with a plain reason, checked inside the update transaction; other edits, publish/unpublish and coding tweaks still work); GET /api/tasks/[id] returns `hasSubmissions`, and the edit form shows Type disabled and Problem slug read-only with "Locked: students have already submitted to this task."; AttemptList `audience` ("student" | "mentor") gives the mentor profile "Not counted (the student can try again)", "Still being checked." and "What they sent"; unused ProfileCard component + test deleted; 9 new tests.
- 2026-10-01 — T31 — Security headers on every route via next.config.ts `headers()` (lib/security/headers.ts): CSP without nonces (self + Google sign-in scripts/frames + Firebase Auth/Firestore APIs + pdf.js blob worker; `'unsafe-eval'` and emulator hosts only in `next dev`; `frame-ancestors 'none'`, `object-src 'none'`, `upgrade-insecure-requests` in production), X-Frame-Options DENY, nosniff, strict-origin-when-cross-origin referrer, Permissions-Policy (camera/mic/geolocation/payment/usb off), no COOP (would break the popup). Verified with `next start`: headers served on pages and API routes, and in Chrome the Google sign-in popup opened with the gapi scripts, the firebaseapp.com auth iframe and Identity Toolkit all loading under the CSP (sign-in itself not completed). Route audit test (every handler guarded; only judge/callback, cron/recompute and me skip requireUser; no raw request.json(); every parsed body is a strictObject), mutation-checked. SPEC §7 checklist re-run (NOTES.md); 11 new tests.
- 2026-10-01 — T32 — Public static /privacy page ("How your data is used": what is stored, who sees it, resume PDF stays on the device, resume/intro text goes to an outside AI service, code runs in a locked-down runner without internet, opt-in leaderboard, contact the mentor/CDC); SiteFooter on every page ("Need help? Message your mentor." + link); privacy links on the login page and an AI-data note next to the resume and intro forms (components/PrivacyLink.tsx); 5 new tests. Served by `next start` (footer present on /login); a real 360 px view could not be checked (the browser window would not shrink below its minimum width).
- 2026-10-01 — T33 — docs/RUNBOOK.md (linked from README): where everything lives, deploying (incl. rules/indexes and redeploy after env changes), every env var with secret/where/meaning, rotating the GitHub judge token (expiry), webhook/cron secrets, Firebase key and AI key, adding a coding problem, routine jobs (nightly stats, manual cron run, export, leaderboard), a "when something goes wrong" table using the app's real error messages, free-tier limits to watch, backups (Spark has none; weekly Excel export, Blaze for a managed export), useful commands; 4 tests keep it in step with .env.example, package.json scripts and README, and check it holds no secret-looking values.
- 2026-10-01 — T34a — Students can be removed and restored by a mentor: `users/{uid}.removed` (+ removedAt/removedBy, restoredAt/restoredBy), set in one transaction by lib/students/removal.ts via POST /api/students/[uid]/remove and /restore (mentor only; viewer/student 403; staff 400; unknown 404; repeatable); removing deletes their studentStats, then a full recompute drops them from taskStats (countedStudents skips removed users, recomputeAll deletes removed users' stats); requireUser and POST /api/me answer 403 "Your access to the portal has been removed…" and /api/me never re-creates or un-removes them; export skips them; leaderboard follows from the deleted stats; Firestore rules treat a removed user as not provisioned (tightening only, mutation-checked); fake Admin gained tx.delete; 8 API/unit tests + 5 rules tests.
- 2026-10-01 — T34b — /mentor/students (mentor + viewer): every student account incl. not-onboarded sign-ups, search by name/email/roll no, Active and Removed groups (name → profile, email, roll no, branch, joined date IST, "Onboarding not finished"); mentor-only "Remove from portal" with an inline confirm step naming the student, and "Restore access"; same controls + a "Removed from the portal" note on the student profile; "Students" button in the mentor dashboard header; runbook section "Removing a student"; 17 unit/render tests + 3 rules tests for the list query.
- 2026-10-01 — T35 — Project subagent `.claude/agents/ui-ux-designer.md` (UI-only edit scope) and its review `docs/UX_REVIEW.md`: 32 ranked findings, shared components to extract, follow-up batches T35a–T35k written into the list.
- 2026-10-01 — T35a — globals.css: `color-scheme: light dark`, design tokens (muted, line, line-strong, surface, link, focus) for both themes exposed as Tailwind colours, one global `:focus-visible` ring (light blue in dark mode), themed `<select>` options, Markdown links use `--link` and images fit the screen; CSS guard test.
- 2026-10-01 — T35b — Header nav row (student: Home, My tasks; mentor/viewer: Dashboard, Tasks, Students; none before onboarding) with `aria-current="page"` incl. sub-pages, brand links to the role's home (`homeFor`), "Skip to content" link and `id="main"` in ProtectedShell; 7 render tests. Redirecting signed-in visitors away from `/` still waits for Ansh (T35 question 3).
- 2026-10-01 — T35c1 — `components/ui/Button.tsx` (`Button` with primary/secondary/danger/ghost, md/sm, `busy`+`busyLabel`; `ButtonLink`; `buttonClasses`), replacing the hand-written button styles in 13 files (login, landing, onboarding, header sign-out, retry, export, remove/restore, load older, task list/form, submit forms); 10 render tests. Left for later batches: the switch track (T35i) and the Write/Preview tabs (T35j).
- 2026-10-01 — T35c2 — `components/ui/TextLink.tsx` (`TextLink`, `textLinkClasses`, `BackLink`) and `components/ui/Note.tsx` (5 tones; danger = alert, `live` = status); replaced the LINK constants, PrivacyLink, back links (profile → Students, task page → My tasks, viewer notice → Tasks, privacy → Portal home) and the boxed/inline error and success notes in 17 files; an unreadable-but-saved feedback reply now shows a success note (`saved` state) instead of a red error; AI-data and login lines use `text-muted` instead of opacity; 13 render tests.
- 2026-10-01 — T35d1 — `components/ui/PageHeader.tsx` (back link, h1, badge, actions, muted subtitle, React `<title>` "… · CDC Mentor Portal") on every signed-in page; static pages (home, My tasks, dashboard, Tasks, Students, task form, onboarding) keep their header while data loads, the task page and student profile keep their back link; `QueryStatus` takes a loading label ("Loading your tasks…"); `TaskListHeader`/`StudentListHeader` exported for the pages; 5 render tests. Tab titles not yet seen in a real browser (pages render only after sign-in).

## Blockers
(none)

## Questions for Ansh
- T35 (UX review): (1) UX-20: may viewers open a read-only task page (description and samples)? The API already allows it; it only changes what viewers see. (2) UX-22: should "Needs attention" come before "Task status" on the mentor dashboard? SPEC §8.6 lists Task status first, so it stays until you say. (3) UX-01: should a signed-in user who opens `/` be sent straight to their home page? (4) UX-07: should tasks that are submitted but still open with attempts left move into "Due soon"? That changes `lib/tasks/studentBoard.ts`, so it is not in T35a–k. (5) UX-28: what should the roll-number hint say (the review guessed "As printed on your college ID card")?
- Loop 3 (planning): SPEC §6 doesn't define how the stats numbers are counted, so I wrote the definitions at the top of Loop 3 (only published tasks and onboarded students count; "submitted" = at least one finished attempt; needs-attention's score rule waits until a student has 2 scores). Two fields not in SPEC §6 are added: `studentStats.overallAvg` (leaderboard "average", export) and `taskStats.avgScoreByBranch` (branch filter for per-task averages). Publishing/unpublishing or moving a due date triggers a full recompute (a few thousand reads at most for ~50 students, well inside the free quota). The nightly cron runs at 00:30 IST. Change any of this before T20 if you disagree.
- T0: You gave the project id `Mentor-Portal-Ansh`. Firebase ids must be lowercase, so I used `mentor-portal-ansh`.
- T2: The public env object lives in `lib/config/publicEnv.ts`, not `env.ts`, because `env.ts` is server-only and the browser must be able to import the public values. Only Firebase admin vars and `ALLOWED_EMAIL_DOMAIN` are required at startup; AI, judge, cron and APP_BASE_URL values are optional until the features that use them (Loop 2/3) check for them. OK?
- T3: Added `NEXT_PUBLIC_USE_EMULATOR` (not in SPEC §13) to `.env.example` and the public env, because T3 asks for an emulator switch. It is ignored in production builds.
- T5: "The user themself" can read `users/{uid}` only once provisioned (the doc exists), so an unprovisioned signed-in user reads nothing, as the T5 tests require. The client should learn its profile from `POST /api/me` (T6), not by reading Firestore before provisioning. OK?ok
- T6: Removing someone from MENTOR_EMAILS/VIEWER_EMAILS does NOT demote them (T6 only asks for upgrades). To remove a mentor's access today you would edit their `users` doc in the Firebase console. Should login also demote staff who are no longer on either list?
- T6: `/api/me` does not refresh `name`/`email` on later logins; they are set once at first login.
- T7: Guards run in the browser (Firebase Auth has no server session here), so protected pages briefly show "Loading…" before redirecting. Real protection stays in Firestore rules and `requireUser`. `/onboarding` is a guarded placeholder until T8. If `/api/me` fails for any reason (including network errors), the user is signed out and shown the message.
- T8: Not in the spec, added for data integrity: onboarding is one-time (a second POST gets 409; a mentor would fix a typo in the console for now), and a roll number already used by another account is refused (409). OK?
- T9a: Decisions the spec leaves open: `maxAttempts` may be 1–10; titles 3–120 chars; descriptions up to 20,000 chars; sample test input/output up to 2,000 chars each; `GET /api/tasks` returns at most 200 tasks (newest due date first) without paging. Added `GET /api/tasks/[id]` for the edit form. A task sent with a `hiddenTests` field is rejected. OK?
- T9b: Added dependency `react-markdown` (not in SPEC §4) for the markdown preview and T10's sanitised descriptions; it drops raw HTML and `javascript:` links. Publishing is a Draft/Published choice in the form, saved with the other fields. Viewers see the task list only (titles are not links); there is no read-only task detail page for them yet. Mentors can still change a task's type after publishing; Loop 2 may need to lock that once submissions exist. OK?
- T10: "Attempts used" counts every submission doc for the task (any status); Loop 2 may want to exclude `error` ones. The student task page hides the judge `problemSlug`. A task counts as "Due soon" for any future due date (no time window). OK?
- Loop 2 (planning): Late submissions are refused after `dueAt` (the spec mentions only an optional "hard close", which tasks don't have). Change this before T14 if you want late submissions allowed but marked late. Stats recompute stays in Loop 3; Loop 2 only calls an empty `onFinished` hook. `attemptsUsed` excludes `error` submissions (answers the T10 question).
- T13: Anthropic calls use the official `@anthropic-ai/sdk` (new dependency) instead of plain fetch: the Claude API guidance requires the SDK in TypeScript projects. Gemini stays a plain REST call (no second SDK). Rubric weights are my first guess (resume: projects 20%, others 10–15%; intro: structure 25%, others 15%); edit lib/ai/rubrics/*.json to change them. The overall score is the AI's weighted average as SPEC says, not recomputed on the server. Refusal fallbacks to another Claude model are NOT enabled, because AI_MODEL can be any model; a refusal is treated as an unusable reply (retry once, then error, attempt not counted). OK?
- T13b: Groq's strict JSON mode only works on the models Groq lists (openai/gpt-oss-20b, openai/gpt-oss-120b, qwen/qwen3.8-27b as of 2026-09-28; list in lib/ai/groq.ts). Other Groq models use best-effort mode; our own validation and one retry still apply. Recommended: AI_MODEL=openai/gpt-oss-120b. SPEC.md §10 still says anthropic | gemini; please add groq there when you next edit the spec.
- T14: Refusals: missing or draft task → 404 "Task not found." (same message, so drafts stay hidden); wrong type → 400; past due → 403; attempts used up → 409. An AI failure returns 502 and the doc keeps `status: error`. `attempt` is `used + 1`, so after a failed try the next one reuses the same number (e.g. two docs with attempt 1, one error and one done). A submission still `running` counts as an attempt until it finishes or passes 10 minutes. `onFinished` also runs after an error. OK?
- T15a: Not in the spec: the browser refuses PDFs over 5 MB and reads only the first 3 pages (a resume should be 1–2). A scanned (image-only) PDF has no text, so the student is asked to paste text instead (no OCR). The PDF extraction was tested with a mocked pdf.js and the production build bundles its worker, but a real PDF has not been tried in a browser yet — H5 step 3 covers that. The detail page's attempts count still includes error submissions until T15b. OK?
- T15b: The task page's history shows the newest 20 attempts and counts attempts from that list (max 10 attempts per task, so only a student with 10+ errors on one task could see a low count; the server still enforces the real limit). I found no record of `firestore.rules`/`firestore.indexes.json` ever being deployed to the real project, so I added step 2b to H5 (`firebase deploy --only firestore:rules,firestore:indexes`). Without the new index the attempt history fails to load in production. OK?
- T16: Decisions for the judge (see judge-repo/README.md "Callback contract"): (a) `verdict` is one of five fixed words and the test number is a separate `firstFailedTest`; the portal shows "Wrong Answer on test 2". (b) A compile error sends `compileOutput` (first 20 lines, max 4,000 chars) as a separate field; SPEC §6 `result` has no place for it, so T18 will keep it in the submission's result (e.g. `judge.compileOutput`) unless you prefer otherwise. (c) `memoryMb` in problem.json is not used yet: every container gets 256 MB as SPEC §9 says. (d) Python gets a syntax check first, so a syntax error shows as "Compilation Error". (e) Containers also run as an unprivileged user with no Linux capabilities (stricter than the spec). (f) Not verified yet: Docker isn't installed here, so run.sh has only been syntax-checked, and its helpers tested with Python; the JVM under `--pids-limit 64` and whether GitHub accepts a ~44 KB `codeB64` in `client_payload` (32 KB code) should be tried in H7, including one Java submission. OK?
- T17: The callback schema is stricter than the README text alone: `firstFailedTest` must equal `passed + 1` (the harness stops at the first failure), Accepted must pass every test, and unknown fields are refused. A callback that fails these checks gets refused even with a valid signature (T18 will answer 400 and log it). The GitHub API version header is `2022-11-28`. OK?
- T18: Decisions: (a) a callback for a submission stuck > 10 minutes is refused (409, no change), because the student was already told "not counted" and may have used that attempt again; unknown or non-coding submissions also get 409. (b) The judge's own internal-error text goes to the server log only; the student sees a plain "the judge had a problem, not counted, try again". (c) Coding results store empty strengths/improvements/nextSteps and a one-line summary such as "Wrong Answer on test 2: 1 of 3 tests passed."; compiler output is kept in `result.judge.compileOutput`. (d) Submit answers 202 with `{submission:{id, attempt, status:"queued"}}`; a dispatch failure answers 502 whether GitHub refused or the env is missing (details in the log). (e) Nothing sets `running` yet: the judge only calls back at the end, so the status goes queued → done. OK?
- T19: Tab in the code box inserts 4 spaces; Esc then Tab moves focus out (so keyboard users are not trapped). The language defaults to the task's first language; the code is kept when switching language and after submitting, for quick fixes. A finished coding attempt shows score, "Passed x of y · verdict" and compiler output; the one-line summary is not repeated. OK?
- T11: Demo accounts are `demo.mentor@…`, `demo.viewer@…`, `demo.student1–6@…` on your ALLOWED_EMAIL_DOMAIN; their roles come from the seeded user docs, so they need not be in MENTOR_EMAILS. The emulators run under your real project id (`mentor-portal-ansh`, from `.env.local`) but everything stays local. I checked that the 8 accounts exist in the Auth emulator with a Google identity, but not yet that the emulator's sign-in window lists them for you to pick (H4 step 1 will show this).
- T21: Besides PATCH, creating a task that is already published (POST) and changing a published task's type also trigger a full recompute, since both change students' stats. The recompute runs before the API replies (a few hundred ms for a mentor save), so serverless can't cut it off. OK?
- T24: "This week" = published tasks due in the next 7 × 24 hours (not the calendar week). "Latest feedback" includes coding results (score + verdict), not only AI feedback. Students do NOT see their own needs-attention flag (it is a mentor tool). The home screen reads only this week's attempts, the 3 newest results and the stats doc, not every submission. The new index must be deployed (H8 step 2) or "Latest feedback" fails to load in production. OK?
- T25: The chart shows the last 8 tasks only (what studentStats keeps), not the whole history. Added `react-is` as a direct dependency (recharts needs the copy matching React 19; npm had picked an old one). Separately, `npm audit` now reports high-severity advisories in `@grpc/grpc-js`, which comes from `firebase-admin` (not from anything added in Loop 3); the only offered fix is `npm audit fix --force` (breaking). I left it alone; worth re-checking when firebase-admin releases an update. The chart was checked by build and tests only, not yet looked at in a browser (H9 step 1).
- T26a: Not in SPEC §6: `studentStats` also stores `showOnLeaderboard`, so the leaderboard is one indexed query (≤ 10 reads per view) instead of reading every opted-in user and their stats. Each row also carries a `rank` (equal averages share a rank: 1, 2, 2, 4). Students who opted in but have no average yet are not listed. Existing studentStats docs get the field on the next recompute (or opt-in); until then they count as not opted in. Needs the new index deployed (H8 step 2). OK?
- T26b: While the leaderboard is off, students still see the "Leaderboard" heading with "switched off right now" and their opt-in switch (so they can opt in in advance); the table itself only appears while it is on. The mentor switch sits on the /mentor placeholder for now; T27 keeps it when the dashboard replaces the placeholder. OK?
- T27: "10 most recent" = the 10 published tasks with the latest due dates (upcoming ones included). The per-skill class average is the mean of each student's own skill average (every student counts once, however many tasks they did). The branch filter also narrows task status counts and the needs-attention list. `components/ProfileCard.tsx` (and its test) is no longer used by any page; it can be deleted in a clean-up. The new tasks index must be deployed (H8 step 2). OK?
- T28: The profile loads a student's newest 50 attempts first; older ones appear with "Load older attempts", so on a very long history a task's row may show fewer attempts until more pages are loaded (the stats numbers are always complete). Attempts on draft/unpublished tasks are only counted, not shown. Inside the mentor view, a failed attempt still reads "…not counted, so you can try again" (shared wording with the student page). OK?
- T29: The export includes only onboarded students (role student) and only published tasks; "All results" lists finished (`done`) attempts only, not errors. Dates are written as IST text (e.g. "20 Sept 2026, 1:30 am IST") rather than Excel date cells, so they never shift with the viewer's time zone. The file never contains what students sent (code, resume or intro text). exceljs brings its own `uuid@8`, which falls under the same moderate `uuid` advisory as before (it only affects v3/v5/v6 with a buffer; exceljs uses v4). The export reads every finished submission, so each download costs about one read per submission. OK?
- Loop 4 (planning): Left OUT on purpose, tell me if you want any of them as tasks: (a) demoting staff removed from MENTOR_EMAILS/VIEWER_EMAILS at login (T6 question; today you edit the users doc in the console); (b) refreshing name/email on every login (T6); (c) forcing `uuid` ≥ 11.1.1 with an npm override to close Dependabot alert #1 (low risk as explained; dismissing the alert is the alternative); (d) allowing late submissions (still refused after the due date). Also: SPEC.md §10 and §13 still say `AI_PROVIDER=anthropic | gemini`; please add `groq` and `GROQ_API_KEY` when you next edit the spec (I may not edit SPEC.md).
- Loop 4 (re-plan, 2026-10-01, at Ansh's request): added T34a/T34b (mentor removes and restores students) and T35 (UI/UX design agent); dropped H10/H11 (no pilot week; launch directly at H12, then T36 fixes from "Launch feedback"). Removing a student is NOT in SPEC: it adds a `removed` flag to `users/{uid}` (blocked, data kept, reversible) and new mentor-only routes, and tightens the Firestore rules so a removed user reads nothing. Please add this to SPEC §2/§6/§7 when you next edit it. If you would rather have an allow-list (only emails you list may enrol, e.g. `MENTEE_EMAILS`), say so before T34a starts: that would replace removal.
- T30: The lock counts ANY submission, including failed (error) attempts, so a task becomes locked from the first try. Changing a coding task's languages, samples or time limit is still allowed after submissions. To change a locked task's type or problem, create a new task instead. OK?
- T31: The CSP keeps `'unsafe-inline'` for scripts and styles (the no-nonce option in the Next 16 guide; nonces would make every page server-rendered on each request). It still blocks scripts from any other site, framing by other sites, plugins and form posts elsewhere. Vercel's preview toolbar (vercel.live) is not allowed, so it may not show on preview deployments; production is unaffected. Only the sign-in popup opening was checked in a browser; please confirm a full sign-in, a resume PDF upload and the progress chart on the deployed site after the next deploy (H12 step 2 covers this). The 3 sample tests in `judge-repo/problems/sum-two-numbers/tests/` (this private repo) are the same as hidden tests 01–03 in the judge repo; harmless for a demo problem, but never copy real problems' tests here. OK?
- T32: The privacy page is my plain-English draft, not legal text: please read it once (it is short) and tell me anything to change, e.g. the CDC office's contact or how long data is kept after the batch graduates (the page does not promise a deletion date). It names no AI vendor or email address on purpose, so switching AI_PROVIDER never makes it wrong. OK?
- T33: The runbook's free-tier numbers (about 50,000 Firestore reads and 20,000 writes a day on Spark) are from memory of Firebase's pricing and labelled "check the current numbers". The free plan has no automatic backups; the runbook suggests downloading the Excel export weekly. If you want real full backups, that needs the Blaze (pay-as-you-go) plan; say so and I can plan it. T34b will add the "remove a student" steps to the runbook. OK?
- T34a: The Firestore rules changed (a removed user reads nothing), so run `firebase deploy --only firestore:rules,firestore:indexes` after pushing; until then removal still blocks every API route and sign-in, but a removed student who is already signed in could keep reading their own old data in an open tab. A student removed while signed in sees "Could not load…" on their next page and the removal message at their next sign-in. If a removed student's email is later added to MENTOR_EMAILS, they stay blocked until a mentor restores them. OK?
