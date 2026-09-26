# PROGRESS

Legend: `- [ ]` to do · `- [x]` done · 🔒 HUMAN = Ansh does this step, the loop stops and explains it.

## Current loop: Loop 1 — Foundation (Week 1)

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

- [ ] **T9 — Mentor task management**
  - API: `POST /api/tasks` (create), `PATCH /api/tasks/[id]` (edit, publish/unpublish), `GET /api/tasks` (mentor/viewer list incl. drafts). Mentor only for writes; viewer gets 403 on writes.
  - Shared zod schema for tasks incl. coding fields (problemSlug lowercase-kebab, at least 1 language, 1–5 sample tests, timeLimitMs 500–5000).
  - UI: `/mentor/tasks` list (status, type, due date IST), `/mentor/tasks/new` and `/mentor/tasks/[id]` form with markdown preview; coding fields appear only for type coding. Viewer sees the list without buttons.
  - Acceptance: schema tests; API authorisation tests (student 403, viewer 403 on write, mentor OK).

- [ ] **T10 — Student task board**
  - `/student/tasks`: published tasks grouped "Due soon" / "Submitted" / "Missed" (submission-based grouping can show everything as "Due soon" or "Missed" until submissions exist).
  - `/student/tasks/[id]`: renders description (markdown, sanitised), type, due date, sample tests for coding, attempts info. Submit controls are a disabled placeholder ("Coming soon") for now.
  - Reads directly from Firestore (allowed by rules) or via API; must not show drafts.
  - Acceptance: works at 360 px; drafts never appear (test the query/filter).

- [ ] **T11 — Seed script**
  - `scripts/seed.ts` (emulator only; refuses to run if not pointed at the emulator): 1 mentor, 1 viewer, 6 students across branches, 4 tasks (2 published, 1 draft, 1 past due).
  - `npm run seed` documented in README with the steps to run the app against emulators.
  - Acceptance: script runs against the emulator without errors.

- [ ] **H4 🔒 HUMAN — End-to-end check**
  1. Run the app locally against the emulator (README steps). Log in as mentor: create, edit, publish a task. Log in as viewer: confirm no edit buttons and that editing via the API is refused.
  2. Log in as a student: onboarding works; only published tasks show.
  3. In the browser console as a student, try reading another student's `users` doc and writing to `tasks`: both must fail.
  4. Deploy to Vercel (import the repo, add the env vars), add the Vercel domain to Firebase Auth → Authorized domains, and log in once on your phone.
  5. When all is fine: push to GitHub. Loop 1 is complete — ask Claude for Loop 2.

## Roadmap (expanded one loop at a time)
- Loop 2 — Submissions: resume and written-intro AI feedback; GitHub Actions code judge; attempts and limits.
- Loop 3 — Dashboards: stats recompute + daily cron, mentee dashboard, mentor dashboard, Excel export, leaderboard flag.
- Loop 4 — Pilot with 5 students, fixes, launch.

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

## Blockers
(none)

## Questions for Ansh
- T0: You gave the project id `Mentor-Portal-Ansh`. Firebase ids must be lowercase, so I used `mentor-portal-ansh`.
- T2: The public env object lives in `lib/config/publicEnv.ts`, not `env.ts`, because `env.ts` is server-only and the browser must be able to import the public values. Only Firebase admin vars and `ALLOWED_EMAIL_DOMAIN` are required at startup; AI, judge, cron and APP_BASE_URL values are optional until the features that use them (Loop 2/3) check for them. OK?
- T3: Added `NEXT_PUBLIC_USE_EMULATOR` (not in SPEC §13) to `.env.example` and the public env, because T3 asks for an emulator switch. It is ignored in production builds.
- T5: "The user themself" can read `users/{uid}` only once provisioned (the doc exists), so an unprovisioned signed-in user reads nothing, as the T5 tests require. The client should learn its profile from `POST /api/me` (T6), not by reading Firestore before provisioning. OK?ok
- T6: Removing someone from MENTOR_EMAILS/VIEWER_EMAILS does NOT demote them (T6 only asks for upgrades). To remove a mentor's access today you would edit their `users` doc in the Firebase console. Should login also demote staff who are no longer on either list?
- T6: `/api/me` does not refresh `name`/`email` on later logins; they are set once at first login.
- T7: Guards run in the browser (Firebase Auth has no server session here), so protected pages briefly show "Loading…" before redirecting. Real protection stays in Firestore rules and `requireUser`. `/onboarding` is a guarded placeholder until T8. If `/api/me` fails for any reason (including network errors), the user is signed out and shown the message.
- T8: Not in the spec, added for data integrity: onboarding is one-time (a second POST gets 409; a mentor would fix a typo in the console for now), and a roll number already used by another account is refused (409). OK?
