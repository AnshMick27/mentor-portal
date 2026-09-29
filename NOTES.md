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

