# NOTES — gotchas and facts for future iterations

## Machine (T0, 2026-09-25)
- OS: Windows 11 Home (10.0.26200). Shells: PowerShell 5.1 and Git Bash.
- Node v24.11.1, npm 11.10.1, Git 2.52.0, Java 21.0.12.1 (Temurin), gh 2.101.0, firebase-tools 15.31.0.
- An old Oracle Java 20 is also installed; Temurin 21 comes first on the machine PATH, so `java` resolves to 21.
- Global npm bin is `%APPDATA%\npm`. A shell that started before the installs may not see `gh`/`firebase`/Java 21;
  open a new terminal (or reload PATH from the Machine + User env vars).

## Project
- GitHub repo: https://github.com/AnshMick27/mentor-portal (private, org `AnshMick27`, branch `main`).
- Firebase project id: `mentor-portal-ansh` (display name "CDC Mentor Portal"); Firestore `(default)` in `asia-south1`.
- Firebase web app: "Mentor Portal Web", appId `1:352157912316:web:c06ec99bc843aef718db79`.
  Its SDK config (output of `firebase apps:sdkconfig --json`) is in `.firebase-web-config.local.json` (git-ignored; used in H2).
- `.firebaserc` sets the default project. `firebase use` refuses to run until `firebase.json` exists (T4), so it was written by hand.
- `firebase firestore:databases:create` kept failing with 403 "Cloud Firestore API has not been used" even after enabling
  the API (likely a multi-account browser issue). Fallback that worked: create the DB in the Firebase console
  (Standard edition, asia-south1, production mode). Verify with `firebase firestore:databases:get "(default)"`.

## Scaffold (T1)
- Next.js **16.3** (App Router), React 19.2, Tailwind 4, ESLint 9 flat config, vitest 5. Next 16 differs from older docs:
  read `node_modules/next/dist/docs/` before using unfamiliar APIs (see AGENTS.md). `next lint` no longer exists; `lint` = `eslint`.
- `typecheck` runs `next typegen` first, which generates the global `LayoutProps`/`PageProps` route types that plain `tsc` needs.
- `@types/node` is pinned to `^24` (matches Node 24); the scaffold's `^20` conflicted with vitest 5's peer range.
- Vitest config is `vitest.config.mts` (a `.ts` config triggers a Vite CJS/ESM warning since package.json has no `"type": "module"`).
  Unit tests live in `tests/**/*.test.{ts,tsx}`; `tests/rules/**` is excluded (run by `test:rules`). `@/` alias works in tests.
- `next dev` rewrites the managed block in AGENTS.md; CLAUDE.md is left alone because AGENTS.md exists. Keep AGENTS.md committed.
- No `next/font/google` (avoids a network fetch at build); system font stack in `globals.css`.

## Env (T2)
- Server env: `getServerEnv()` from `lib/config/env.ts` (server-only, cached). `MENTOR_EMAILS`/`VIEWER_EMAILS` are already
  parsed into lowercase `Set`s there. Blank values (`KEY=`) count as missing. AI/judge/cron/APP_BASE_URL are optional:
  code that needs them must check and fail clearly.
- Public env: `getPublicEnv()` from `lib/config/publicEnv.ts`. Keep each `process.env.NEXT_PUBLIC_*` referenced literally (Next inlines them).
- Vitest aliases `server-only` to `tests/stubs/server-only.ts`, so server modules are testable. The real guard still works:
  importing `env.ts` from a client component fails `next build` (verified).
- `@next/env` strips inline ` # comments` in .env files. A double-quoted `FIREBASE_ADMIN_PRIVATE_KEY="...
..."` arrives with
  REAL newlines; unquoted/Vercel values keep literal `
` — T3's key helper must handle both.

## Firebase modules (T3)
- firebase 12.19 (client), firebase-admin 14.5 (modular imports: `firebase-admin/app|auth|firestore`).
- Server: `getAdminAuth()` / `getAdminDb()` from `lib/firebase/admin.ts` (named app `mentor-portal-admin`, server-only).
  Browser: `getClientAuth()` / `getClientDb()` from `lib/firebase/client.ts` (cached on globalThis to survive HMR).
- Emulator: `NEXT_PUBLIC_USE_EMULATOR=true` and NODE_ENV != production. Ports in `lib/firebase/emulator.ts`
  (auth 9099, firestore 8080); T4's firebase.json must use the same ports. Admin in emulator mode sets
  FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST and uses no credentials.
- Don't name non-hook helpers `useX` (react-hooks lint rule treats them as hooks).
- `npm audit`: 2 moderate (uuid<11 via firebase-admin → @google-cloud/storage → gaxios). No non-breaking fix; we never use
  Storage and the bug needs uuid v3/v5/v6 with a buffer. Re-check when firebase-admin updates.

## Rules tests (T4)
- `npm run test:rules` = `firebase emulators:exec --only firestore --project demo-mentor-portal "vitest run --config vitest.rules.config.mts"`.
  The `demo-` project id means no real Firebase resources are touched; `tests/rules/testEnv.ts` uses the same id.
- Rules tests live in `tests/rules/**/*.test.ts` (excluded from the unit `vitest.config.mts`). Use `createRulesTestEnv()`,
  `clearFirestore()` in `beforeEach`, `cleanup()` in `afterAll`. Seed data with `testEnv.withSecurityRulesDisabled(...)`.
- Verbose reporter prints every test name (H3 reads them). The `GrpcConnection ... PERMISSION_DENIED` console line during
  write-denied tests is expected noise.
- First run downloads the Firestore emulator jar (~cached in `~/.cache/firebase/emulators`). Needs Java 21 on PATH.
- Harness sanity-checked: flipping the rules to `if true` makes both tests fail.

## Security rules (T5)
- Role is read from `users/{request.auth.uid}` inside the rules (one `get`/`exists` per request), never from token claims.
- Client queries MUST carry the filter the rules check, or the whole query is denied: students query tasks with
  `where("status","==","published")` and submissions with `where("uid","==",uid)`. Students cannot list users/studentStats.
- Rules tests: `setupSeededRulesEnv()` + `dbAs(env(), uid)` from `tests/rules/fixtures.ts` (reseeds every collection before
  each test; `UID.stranger` is signed in but unprovisioned). The `false for 'update' @ L..` stderr lines are expected noise.

## Auth (T6)
- API routes: `const auth = await requireUser(request, ["mentor"]); if (!auth.ok) return auth.response;` then use
  `auth.value` (typed `UserProfile`). Errors are `jsonError(status, msg)` from `lib/api/errors.ts` → `{ error }`.
- `verifyIdentity` (token + email_verified + exact domain, no Firestore) is only for `/api/me`; everything else uses `requireUser`.
- Role/Branch enums and `storedUserSchema` live in `lib/validation/user.ts` (reuse in T8 onboarding).
- Tests mock the Admin SDK with `tests/auth/fakeAdmin.ts`: `vi.mock("@/lib/firebase/admin", async () => (await import("./fakeAdmin")).fakeAdmin.module)`
  and the env with `fakeEnv`. Fill `fakeAdmin.tokens` (token → decoded) and `fakeAdmin.users`; clear both in `beforeEach`.
  vi.mock factories are hoisted, so they must `await import(...)` rather than use top-level imports.

## Client auth (T7)
- `AuthProvider` (root layout) exposes `useAuth()` → `{ view, message, signIn, signOut, refreshProfile, getIdToken }`.
  Call `refreshProfile()` after anything that changes the user doc (T8 onboarding). Use `getIdToken()` for `Authorization: Bearer`.
- Guarded areas use a layout with `<ProtectedShell area="student|mentor|onboarding">`; pages inside call `useSignedInProfile()`.
  Redirect rules are the pure `guardRedirect()` in `lib/auth/guards.ts` (unit-tested); add new areas there.
- `/login` is a server page that passes `ALLOWED_EMAIL_DOMAIN` to the client panel for the Google `hd` hint, so
  `next build` needs the server env (it prerenders /login).
- No browser test runner is installed; UI tests use `renderToStaticMarkup` on presentational components.

## Onboarding (T8)
- `onboardingSchema` (`lib/validation/onboarding.ts`) is a zod `strictObject`: unknown fields → 400. Use strict schemas for
  every client-submitted body so a client cannot smuggle `role`/`score` fields.
- Initial `studentStats` shape comes from `initialStudentStats()` (`lib/stats/`); Loop 3's recompute should reuse its type.
- Fake Admin SDK (`tests/auth/fakeAdmin.ts`) supports any collection, `where(==)`/`limit` queries and tx get/create/set/update.
  Use `fakeAdmin.reset()` in `beforeEach` and `fakeAdmin.collection("name")` to inspect docs.

## Tasks API (T9a)
- Schemas in `lib/validation/task.ts`: `taskInputSchema` (create; defaults status draft + per-type maxAttempts),
  `taskPatchSchema` (partial; `coding: null` removes). PATCH merges into the stored task (`mergeTaskPatch`) and re-validates
  the WHOLE task, so cross-field rules (coding iff type coding) always hold.
- API returns `TaskDto` (dates as ISO strings); Firestore stores `dueAt/createdAt/updatedAt` as Timestamps. Never write
  `undefined` fields to Firestore (Admin SDK throws); omit keys instead (see `toStored`).
- Route bodies: use `parseBody(request, schema)` from `lib/api/parseBody.ts`. Dynamic route context type: `RouteContext<"/api/tasks/[id]">`.
- Avoid long bash heredoc chains that contain Python `'''` strings: a quoting slip makes bash skip the whole command.
  Use the Write tool for new files.

## Mentor task UI (T9b)
- Dependency added: `react-markdown` ^10 (SPEC §4 lists none for markdown; T9b preview and T10 need sanitised rendering).
  Always render mentor text via `components/Markdown.tsx` (`skipHtml`, safe links). Styles: `.markdown` in globals.css.
- Dates: `formatIst()` for display; `toIstInputValue`/`fromIstInputValue` for `<input type="datetime-local">` (always IST,
  independent of the browser's zone) in `lib/dates/ist.ts`.
- Client API calls: `apiFetch(getIdToken, path, { method, body })` (`lib/api/client.ts`) or the `useApiQuery(path, zodSchema)`
  hook + `<QueryStatus>` for GETs. Validate replies with zod (`taskDtoSchema`).
- Dynamic client pages read params with `use(params)` and type props as `PageProps<"/mentor/tasks/[id]">`.

## Student board (T10)
- Student reads use `lib/tasks/studentQueries.ts` (`publishedTasksQuery`, `ownSubmissionsQuery`, `loadStudentBoard`,
  `loadStudentTask`). `tests/rules/studentQueries.test.ts` runs these exact functions against the emulator, so any new
  student query should be added there too. Rules tests can import `@/…` (alias added to `vitest.rules.config.mts`).
- `taskDocToDto` (`lib/tasks/taskDoc.ts`) parses task docs from BOTH SDKs (duck-typed Timestamps); the server store uses it too.
- Client async loading: `useAsyncData(stableLoader, message)` + `<QueryStatus>`; wrap loaders in `useCallback`.
- Reading a draft as a student throws `permission-denied`; `loadStudentTask` maps that to "not found".

## Seed and emulators (T11)
- `npm run emulators` (auth 9099 + firestore 8080, project from .firebaserc) then `npm run seed` (`scripts/seed.mts`).
  Scripts run with Node 24's native TypeScript stripping: relative imports need explicit `.ts`/`.mts` extensions
  (`allowImportingTsExtensions` is on in tsconfig), `@/` aliases do NOT work at runtime, only `import type` from them.
  `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` hides the ESM-detection warning (package.json has no "type").
- Admin SDK against emulators: pass only `projectId` (Firestore rejects non-cert custom credentials) and set
  `METADATA_SERVER_DETECTION=none` to skip the slow GCP metadata probe (`MetadataLookupWarning`). `lib/firebase/admin.ts`
  may show the same warning in emulator mode.
- Seed data is pure in `scripts/seedData.mts` (tested in `tests/scripts/`); tasks go through `taskInputSchema`.
- Clear emulator Firestore: `curl -X DELETE "http://127.0.0.1:8080/emulator/v1/projects/<id>/databases/(default)/documents"`.

## Deploy (Vercel)
- firebase-admin 14's dep jwks-rsa 4 `require()`s `jose`, and jose 6 is ESM-only. On a runtime without require(esm),
  every `/api/*` route crashed with `ERR_REQUIRE_ESM`, which the login page shows as "Something went wrong". Fixed by
  `overrides: { jwks-rsa: { jose: ^5 } }` in package.json (jose 5 ships CJS; jwks-rsa only uses importJWK/exportSPKI).
  `engines.node` is also pinned to `24.x`. Keep both. Verify with:
  `node --no-experimental-require-module -e "require('firebase-admin/auth')"`.

## Submissions (T12)
- Limits live in `lib/submissions/limits.ts`; schemas in `lib/validation/submission.ts`. Feedback content is TRIMMED before limits apply; code is not trimmed (32 KB counted in UTF-8 bytes via `utf8Bytes`).
- Always count attempts with `attemptsUsed(subs, now)` (skips `error` and >10 min stuck queued/running) and show status via `effectiveStatus`. Stored result arrays are loose; the AI reply's 2–3/1–3 counts are enforced in lib/ai (T13).
- `timestampLike` (Firestore Timestamp duck type) is shared from `lib/validation/timestamp.ts`.

## AI feedback (T13)
- Dependency added: `@anthropic-ai/sdk` (Claude API guidance: use the official SDK in TS, not raw fetch). Its zod helper imports `zod/v4`, which zod 4.x provides.
- `generateFeedback(input, model?)`: pass a `FeedbackModel` in tests/routes; the default builds one from env. Both providers accept an injected `fetch` (the Anthropic SDK takes `fetch` in its constructor), so tests never hit the network. Use 4xx (not 5xx) in SDK error tests: the SDK retries 5xx with a backoff delay.
- `aiWireSchema` (plain, sent as JSON schema) vs `aiFeedbackSchema` (strict limits + rounding, checked after). Transforms/refines can't go in the wire schema.
- AiFeedbackError kinds: config | provider (no retry) | invalid_output (retried once). Rubrics: lib/ai/rubrics/*.json, weights must sum to 100.

## Groq (T13b)
- `AI_PROVIDER=groq` uses `lib/ai/groq.ts` (plain fetch, OpenAI-compatible). `strict: true` only for `GROQ_STRICT_MODELS`; update that set if Groq's structured-outputs docs change. A 400 containing "does not match the expected schema" = invalid_output (retried); any other non-2xx = provider error.
- Fallback (T38): `createModelWithFallback` (the default in `generateFeedback`) tries `AI_PROVIDER` first on every call and moves that call to `AI_FALLBACK_PROVIDER`/`AI_FALLBACK_MODEL` only on a `provider` error; `invalid_output` is still retried on the main model. Groq free tier limits are per model (8,000 tokens/min each), so `openai/gpt-oss-20b` backs up `openai/gpt-oss-120b` at no cost. Gemini's free tier may use inputs for training, so it is not a backup option for resumes unless billing is on.
- `FEEDBACK_JSON_SCHEMA` = `z.toJSONSchema(aiWireSchema)` minus `$schema`; zod's default output already marks every field required with `additionalProperties: false`.

## Feedback route (T14)
- `lib/submissions/feedbackSubmission.ts`: `startFeedbackSubmission` (task + attempt checks + create `running`, one transaction; query `where uid == && taskId ==`) and `finishFeedbackSubmission`. T18's judge submit can mirror its shape.
- Route tests mock `@/lib/ai/provider` (`generateFeedback: vi.fn()`) and `@/lib/submissions/onFinished`; the fake Admin DocRef now supports `update`.
- Route segment config `export const maxDuration = 60` works unchanged in Next 16 route handlers.

## Submit forms (T15a)
- Dependency added: `pdfjs-dist` ^6 (SPEC §4). Browser-only: `lib/submissions/pdfjsLoader.ts` is imported dynamically on file pick; the worker is set via `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`, which the Next 16 build emits under `.next/static/media/`. In v6 `PDFDocumentProxy` has no `destroy()` (use the loading task's) and `isEvalSupported` is gone.
- Pure logic is testable without pdf.js: `extractPdfText(file, loader)` / `itemsToText` (`lib/submissions/pdfText.ts`), `checkIntroLength` (`wordCount.ts`), `submitAvailability` (`availability.ts`, mirrors the server's `now <= dueAt` and attempts checks).
- `TaskSubmitSection` owns `useFeedbackSubmit`, so the result note survives when the last attempt closes the form. Component tests that render it mock `@/components/auth/AuthProvider` (`useAuth` throws outside the provider).

## Results and history (T15b)
- Client submission docs → `SubmissionView` (`lib/submissions/submissionDoc.ts`, `createdAt` as Date). Progress per task: `taskProgress`/`summarizeByTask` in `lib/tasks/studentBoard.ts` (wraps `attemptsUsed` + `bestScore`); `countAttempts` is gone.
- Task page history = `watchOwnTaskSubmissions` (onSnapshot on `ownTaskSubmissionsQuery`: uid ==, taskId ==, orderBy createdAt desc, limit 20) via `useOwnTaskSubmissions`. It needs the composite index in `firestore.indexes.json`; the emulator does NOT enforce indexes, so a missing index only shows up in production. Deploy with `firebase deploy --only firestore:rules,firestore:indexes`. T19 can reuse the same listener for live judge status.
- `SubmissionResultView` already renders `result.judge` (passed/total · verdict); T19 only needs compile-output display.

## Judge template (T16)
- `judge-repo/` is copied by Ansh into the private judge repo (H6); it is not part of the Next app (not linted/typechecked). Static security checks live in `tests/judge/judgeRepo.test.ts`; keep them passing when editing judge.yml/run.sh.
- Callback contract is in `judge-repo/README.md`: header `x-judge-signature: sha256=<hex>` = HMAC-SHA256(raw body, JUDGE_WEBHOOK_SECRET); body `{submissionId, status:"done", judge:{passed,total,verdict,firstFailedTest?}, compileOutput?}` or `{submissionId, status:"error", error}`. T17's zod schema must match it exactly.
- `.gitattributes` forces LF for `judge-repo/**` (core.autocrlf is false here, but the Write tool/Windows editors could add CRLF; bash on the runner fails on CRLF).
- Windows `python` can't open msys `/tmp/...` paths embedded inside `python -c "..."` strings; pass paths as argv instead.
- No Docker on this machine: run.sh can only be `bash -n` checked locally.

## Judge libs (T17)
- `dispatchJudge(input, { repo?, token?, fetch? })` throws `JudgeDispatchError` kind `config` (env missing: fix deployment) or `github` (refused/unreachable: mark the submission `error`, tell the student to retry). Omitting repo/token reads env.
- `verifyJudgeCallback(rawBytes, request.headers.get("x-judge-signature"), secret?)` → `{ok, payload}` or `{ok:false, reason: config|too_large|signature|payload}`. T18: read the body with `await request.arrayBuffer()` (never `request.json()` before verifying); map signature → 401, payload → 400, too_large → 413, config → 500.
- `tests/judge/judgeRepo.test.ts` also checks the verdict list, compile-output cap and id pattern match `judge-repo/`; change both sides together.


## Judge routes (T18)
- `startSubmission(sub, now, check)` (`lib/submissions/startSubmission.ts`) is THE submit transaction (published, type, due date, attempts, create). Feedback and judge wrap it; `check(task)` adds type-specific refusals and returns extra fields (e.g. `problemSlug`).
- `lib/submissions/judgeSubmission.ts`: `startJudgeSubmission`, `failJudgeDispatch`, `applyJudgeCallback` (uses `effectiveStatus`, so late callbacks are 409), `judgeToResult`/`judgeSummary`. `judgeResultSchema` now has optional `compileOutput` for T19.
- Route tests mock `@/lib/judge/dispatch` with `importOriginal` (keep `JudgeDispatchError`) and sign callback bodies with node:crypto HMAC; env mock needs `JUDGE_WEBHOOK_SECRET`.

## Coding UI (T19)
- Judge display logic is pure in `lib/submissions/judgeDisplay.ts` (`judgeStatusView`, `verdictLabel`, `insertIndent`, `codeSize`); components only render it.
- `useNow(ms)` (`components/useNow.ts`) re-renders the task page every 15 s so time-based states (10-min timeout, due date) update without a reload.
- Tests that render `StudentTaskDetail` for ANY task type must mock `@/components/auth/AuthProvider` (both submit sections call `useAuth`).

## Stats (T20)
- `lib/stats/compute.ts` is pure: `computeStudentStats(user, tasks, submissions, now)` / `computeTaskStats(task, users, submissions)` take plain `Stats*` inputs (Dates, not Timestamps; see `lib/stats/types.ts`) and ignore unrelated docs, so T21 can pass whole collections. Averages go through `averageScore` (sums whole tenths, no float drift).
- compute.ts and `lib/submissions/scoring.ts` use RELATIVE `.ts` value imports (only `import type` from `@/`) so plain Node can load them for the seed (T23). Keep it that way; check with `node --input-type=module -e "import('./lib/stats/compute.ts')"`. Next/Turbopack builds these imports fine.
- Stored docs parse with `storedStudentStatsSchema` / `storedTaskStatsSchema` (`lib/validation/stats.ts`); never write `undefined` (optional fields like `overallAvg`, `avgScore`, `needsAttentionReason` are omitted instead).

## Recompute (T21)
- `lib/stats/recompute.ts`: `recomputeStudent(uid)` (false = not an onboarded student, nothing written), `recomputeTask(id)` (deletes stats of draft/missing tasks), `recomputeAll()` → `{students, tasks}` (T22 cron), `recomputeAllAfter(reason)` (logs, never throws). All take an optional `now` for tests.
- Get `getAdminDb()` ONCE before starting parallel reads: a synchronous throw while building a `Promise.all` array leaves earlier promises rejected and unhandled (vitest reports "Unhandled Errors").
- Route tests that create/patch tasks mock `@/lib/stats/recompute`; tests/stats/recompute.test.ts runs the real thing on the fake Admin (now with `doc.delete()` and `collection.get()`).
- `npm run check` once died at the rules step with `java -version` exit 3221225794 (0xC0000142, a transient Windows DLL-init failure) and the emulator hung; `java -version` and `npm run test:rules` passed on retry.
- Many repo files are CRLF (core.autocrlf=false), others LF. Python text-mode read/write silently converts CRLF files to LF (whole-file diffs, happened in T20/T21 and was fixed); prefer the Edit tool, or open files in binary and keep their endings.

## Cron (T22)
- `vercel.json` holds the only cron (`/api/cron/recompute`, `0 19 * * *` UTC = 00:30 IST). Vercel Cron sends GET with `Authorization: Bearer $CRON_SECRET` automatically when that env var exists in the project; Hobby runs it once a day, timing within that hour. A test pins the schedule.
- Manual run: `curl -H "Authorization: Bearer <secret>" https://<app>/api/cron/recompute`, or Vercel → Settings → Cron Jobs → Run.

## Seed v2 (T23)
- Demo story lives in `scripts/seedSubmissions.mts` (`STORY` by student number; task keys are seed ids without `seed-`). Stats are computed with `lib/stats/compute.ts` inside `buildSeedData`, so seeded dashboards match what recompute would write. Attempts are dated relative to the due date: for a task due in N days, use daysBeforeDue ≥ N + 1 or the attempt lands in the future (a test checks this).
- Read the emulator back over REST with `Authorization: Bearer owner` (bypasses rules): `curl -H "Authorization: Bearer owner" "http://127.0.0.1:8080/v1/projects/<id>/databases/(default)/documents/studentStats"`.
- Stopping a background `npm run emulators` task does NOT kill the Java Firestore emulator; it keeps port 8080 and the next `npm run test:rules` fails with "port taken". Free it: find the PID with `Get-NetTCPConnection -LocalPort 8080` and stop that process (and the firebase node process on 9099/4400).

## Student dashboard (T24)
- Dashboard code lives in `lib/dashboard/` (pure `student.ts`, client queries `studentQueries.ts`); the page is `app/student/page.tsx` → `StudentDashboard` (presentational, render-tested). Its rules tests are in `tests/rules/studentDashboard.test.ts`.
- Run one rules file quickly: `npx firebase emulators:exec --only firestore --project demo-mentor-portal "npx vitest run --config vitest.rules.config.mts tests/rules/<file>"`.
- `formatIst` takes an ISO string; pass `date.toISOString()` for a `SubmissionView.createdAt`.
- Composite indexes so far: submissions (uid, taskId, createdAt desc) and (uid, status, createdAt desc). `uid == && taskId in [...]` needs no composite index (equality-only).

## Charts (T25)
- Dependencies: `recharts` ^3.10 (SPEC §4) and `react-is` 19.2.x (NOT in SPEC): recharts' peer `react-is` resolved to the hoisted 16.13.1 from eslint-plugin-react, which predates React 19's element format; recharts asks for the version matching React. Keep `react-is` in step with `react` when upgrading.
- Chart components are `"use client"`. Shape data in a pure helper (`lib/dashboard/progressChart.ts`) and unit-test that; `renderToStaticMarkup` renders ResponsiveContainer at 0 width (no SVG), so render tests check only the wrapper, empty state and the sr-only table.
- `npm audit` (2026-10-01): 5 high `@grpc/grpc-js` advisories via firebase-admin → @google-cloud/firestore → google-gax, plus the old uuid moderates. Only `--force` (breaking) fixes; left as is.

## Leaderboard API (T26a)
- Server: `lib/leaderboard/store.ts` (`getAppConfig`, `setLeaderboardEnabled`, `setShowOnLeaderboard`, `loadLeaderboard`), pure `rankEntries` in `lib/leaderboard/rank.ts`; schemas + reply schemas for the client in `lib/validation/config.ts` (`leaderboardEntrySchema` is strict, so a leaked field fails parsing).
- Client calls for T26b: `GET /api/leaderboard` → `{entries}` or 404 "Leaderboard is off." (hide the card on 404); `POST /api/me/leaderboard {showOnLeaderboard}` then `refreshProfile()` so `profile.showOnLeaderboard` updates; `GET/PATCH /api/config {leaderboardEnabled}` for the mentor switch.
- Fake Admin queries now chain `orderBy` and, like Firestore, drop docs missing an ordered field.

## Mentor dashboard (T27)
- `loadMentorDashboard(db)` → `{tasks, taskStats: Map, students: MentorStudent[]}` (MentorStudent = stored studentStats + uid). Pure filters/aggregates in `lib/dashboard/mentor.ts` take a `BranchFilter` ("all" | Branch); T29's export can reuse `classSkillAverages`/`inBranch`.
- Firestore indexes now: submissions (uid, taskId, createdAt↓), submissions (uid, status, createdAt↓), studentStats (showOnLeaderboard, overallAvg↓, name), tasks (status, dueAt↓). The emulator ignores indexes, so only H8's deploy proves them.
- The rules fixture's `taskStats` doc has no `avgScoreByBranch`; the schema defaults it to `{}`.

## Student profile (T28)
- `/mentor/students/[uid]`: `loadStudentProfile(db, uid)` (undefined = not a student → "not found") + `loadSubmissionPage(db, uid, cursor?)` (50 per page; `cursor` only when a full page came back). Index: submissions (uid, createdAt↓) — 5th composite index.
- `AttemptList` (components/student/SubmissionHistory.tsx) renders attempts for both the student task page and the mentor profile (`sentLabel`).
- The rules fixture's `sub-alice` is dated 2026-09-26 10:00 IST; date generated test docs after it if a test depends on "newest first".

## Excel export (T29)
- Dependency `exceljs` ^4.4 (SPEC §4), server-only (`lib/export/workbook.ts` imports `server-only`). `buildExportWorkbook(input, now)` returns `Uint8Array<ArrayBuffer>`: TS's `BodyInit` refuses an `ArrayBufferLike`-backed array, so the bytes are copied into a fresh ArrayBuffer.
- Read a workbook back in tests: `new ExcelJS.Workbook().xlsx.load(bytes.buffer)`, then `row.values.slice(1)` (exceljs rows are 1-based; trailing blank cells are dropped).
- To make the fake Admin fail INSIDE a route (after `requireUser` has read `users`), spy on `db.collection` and throw only for the collection the route reads; restore the spy.

## Security hardening (T31)
- Headers come from `lib/security/headers.ts` via `next.config.ts` (relative `.ts` import; next.config can't use `@/`). Adding a third-party script, frame, font or API host means adding it to the CSP there, or the browser blocks it silently (check DevTools console for "Refused to ...").
- `tests/security/routeAudit.test.ts` walks `app/api/**/route.ts`: a new route must call `requireUser(request, [...])` in every handler, or be added to its allow-list with its own guard; bodies go through `parseBody` with a `z.strictObject` schema exported from lib/validation/{config,onboarding,submission,task}.ts (add new schema modules to the test's import list).
- `next start -p <port>` is handy to check real headers (`curl -D - -o /dev/null http://localhost:<port>/login`); stopping its background task leaves the node process listening, so stop it by PID afterwards.
- SPEC §7 checklist (2026-10-01): (1) firestore.rules: every match has `allow write: if false`, catch-all denies read+write; (2) read rules covered by 88 rules tests; (3) route audit test; (4) only NEXT_PUBLIC_FIREBASE_* + NEXT_PUBLIC_USE_EMULATOR reach the browser, secrets only in server-only modules/route handlers, only `.env.example` tracked; (5) hidden tests: only the demo sum-two-numbers samples are in judge-repo/ here, real ones live in the private judge repo; (6) judge sandbox: tests/judge/judgeRepo.test.ts; (7) HMAC: verifyCallback tests; (8) limits: submission schema + API tests; (9) prompt injection: lib/ai prompt tests; (10) rules tests run in `npm run check`. No gaps found.

## UI design pass (T35)
- `docs/UX_REVIEW.md` holds the findings (UX-xx) each T35 sub-task refers to. The `ui-ux-designer` agent in `.claude/agents/` may do purely presentational batches.
- Theme tokens live in `app/globals.css` (`text-muted`, `border-line`, `border-line-strong`, `bg-surface`, `text-link`); prefer them over `opacity-*` or raw black/white alpha colours. The global `:focus-visible` rule is unlayered, so it overrides any `focus-visible:outline-*` utility: per-element focus classes are now redundant and can be dropped as components move to `components/ui/`.
- Page titles: client pages set the browser-tab title by rendering React `<title>` inside `PageHeader` (Next docs, error.md, recommend this for client components). Server pages (login, privacy) keep `export const metadata`. A new page should use `PageHeader` rather than its own h1.
- Mentor markdown never shows images (Markdown.tsx maps `img` to a note): the CSP only allows self/data/googleusercontent images, so pasted links would show broken. To allow task images later, host them on an allowed origin and change both.

## Stitch design (T40)
- Source: Stitch project "CDC Mentor Portal Web Application" (id 15312957182452190568), fetched with the Stitch MCP tools (`list_screens`, then each screen's `htmlCode`/`screenshot` download URL). Only the 7 mentor screens are real designs; the `frame_*.png` entries are captures of the old app.
- New tokens: `bg-card`, `bg-surface-strong`, `bg-primary`/`hover:bg-primary-hover`, `shadow-card`, fonts `--font-sans` (Inter) and `--font-mono` (JetBrains Mono) via `next/font/google` in `app/layout.tsx` (self-hosted, so `font-src 'self'` still holds; `next build` downloads them, so it needs network).
- Every `<select>` matches `:read-only`, so never put `read-only:` styles in `inputClasses`; use `[&:is(input):read-only]:`.
- Without a working sign-in popup (e.g. remote session), preview pages by rendering components with `renderToStaticMarkup` + demo data and the dev server's compiled CSS; never fake an auth session.
- Paste block (T46a): React `onBeforeInput` is a polyfill without `inputType`, so `usePasteGuard` adds a native `beforeinput` listener. To refuse a change in a controlled textarea, just do not call the setter: React puts the old value back. Composition `beforeinput` is not cancellable, so `change` is the backstop there.
- Integrity (T46b): thresholds live in `lib/submissions/integrityFlags.ts`; the draft call is in `useCodeSubmit`/`useFeedbackSubmit` (`openDraft`), not in the forms, so the forms need no taskId. `drafts` is denied to every client by the catch-all rule (tests/rules/drafts.test.ts).
- Similarity (T47): thresholds in `lib/integrity/similarity.ts`. Jaccard was too strict (a copied intro with 4 words changed scored 73%), so it uses shared / smaller set. Java and C++ boilerplate (class Main, Scanner, includes) is shared by everyone and pushes short solutions up; if mentors see noise, raise `MIN_CODE_TOKENS` before touching the percent.
- Approval (T48): `pendingApproval` absent = approved, so students from before T48 need no migration. Pending is treated like removed everywhere (rules `isProvisioned`, `countedStudents`, export, roster, `recomputeAll` deletes stats) except `requireUser(..., { allowPending: true })` on onboarding. New API routes need `npx next typegen` before `tsc` knows their `RouteContext`.
- Late cutoff (T49): always go through `lateCutoff(task)` (`lib/validation/task.ts`), never `dueAt` alone, to decide whether a task still takes work. `lateUntil` absent = `LATE_GRACE_DAYS` after `dueAt`, so tasks from before T49 need no migration. Tests that render "late" must stay within 7 days of the due date.
- Scenario (T50): anything students must not see goes in `taskSecrets/{taskId}`, never on the task doc (students read published task docs straight from Firestore). The catch-all rule already denies it; `tests/rules/taskSecrets.test.ts` proves it. `getTask` (mentor API) merges the notes in; `taskDocToDto` never sees them. A new typed-answer type goes through `isTypedAnswer` (integrity + drafts) and `findSimilarPairs` treats every non-coding type as prose.
