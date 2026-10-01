# Runbook — CDC Mentor Portal

How to run the portal day to day: deploys, secrets, adding coding problems, fixing common problems, and
staying inside the free tiers. Written for the mentor (Ansh). The design itself is in `SPEC.md`; local
development with demo data is in `README.md`.

**Where things live**

| What | Where |
|---|---|
| The app | Vercel project (deploys from GitHub `main`) |
| Code | GitHub `AnshMick27/mentor-portal` (private) |
| Judge and hidden tests | GitHub `AnshMick27/mentor-portal-judge` (private) |
| Data and sign-in | Firebase project `mentor-portal-ansh` (Firestore in `asia-south1`, Google sign-in) |
| Secrets | Vercel → Settings → Environment Variables, your local `.env.local`, and the judge repo's Actions secrets |

---

## 1. Deploying a change

1. On your computer, in the project folder: `npm run check` must pass (types, lint, tests, security rules tests).
2. `git push`. Vercel builds and deploys `main` by itself; wait until the deployment shows **Ready**.
3. If the change touched `firestore.rules` or `firestore.indexes.json`, also run:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   New indexes take a few minutes to build: Firebase console → Firestore → Indexes must show **Enabled**.
   Until then the page that needs the index shows "Could not load…".
4. Open the site on your phone and check the page you changed.

**Changing an environment variable** only takes effect after a new deployment: Vercel → Deployments → the
latest one → **⋯ → Redeploy**. Type values plainly: no quotes, no spaces, no `# comments` (Vercel does not
strip them the way `.env.local` does).

---

## 2. Environment variables

`.env.example` lists them all with a short comment. "Vercel" means Vercel → Settings → Environment Variables
(Production). Keep `.env.local` the same for local runs. Nothing marked secret may ever be committed to git
or start with `NEXT_PUBLIC_`.

| Variable | Secret? | Where | What it is |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | no | Vercel, `.env.local` | Firebase web app config (identifies the project) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | no | Vercel, `.env.local` | e.g. `mentor-portal-ansh.firebaseapp.com`; also allowed in the security headers |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | no | Vercel, `.env.local` | Firebase project id |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | no | Vercel, `.env.local` | Firebase web app id |
| `NEXT_PUBLIC_USE_EMULATOR` | no | `.env.local` only | `true` = local emulators (ignored in production builds) |
| `FIREBASE_ADMIN_PROJECT_ID` | yes | Vercel, `.env.local` | From the service-account JSON |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | yes | Vercel, `.env.local` | From the service-account JSON |
| `FIREBASE_ADMIN_PRIVATE_KEY` | yes | Vercel, `.env.local` | From the service-account JSON (keep the `\n` sequences) |
| `ALLOWED_EMAIL_DOMAIN` | no | Vercel, `.env.local` | Only this email domain may sign in, e.g. `acropolis.in` |
| `MENTOR_EMAILS` | no | Vercel, `.env.local` | Comma-separated; these accounts become mentors at their next sign-in |
| `VIEWER_EMAILS` | no | Vercel, `.env.local` | Comma-separated; read-only viewers (CDC leadership) |
| `AI_PROVIDER` | no | Vercel, `.env.local` | `groq`, `gemini` or `anthropic` |
| `AI_MODEL` | no | Vercel, `.env.local` | Model id for that provider |
| `GROQ_API_KEY` | yes | Vercel, `.env.local` | Needed when `AI_PROVIDER=groq` |
| `GEMINI_API_KEY` | yes | Vercel, `.env.local` | Needed when `AI_PROVIDER=gemini` |
| `ANTHROPIC_API_KEY` | yes | Vercel, `.env.local` | Needed when `AI_PROVIDER=anthropic` |
| `GITHUB_JUDGE_REPO` | no | Vercel, `.env.local` | `AnshMick27/mentor-portal-judge` |
| `GITHUB_JUDGE_TOKEN` | yes | Vercel, `.env.local` | Fine-grained token, judge repo only, **expires** (see §3) |
| `JUDGE_WEBHOOK_SECRET` | yes | Vercel, `.env.local` **and** judge repo secret | Must be identical in both places |
| `CRON_SECRET` | yes | Vercel, `.env.local` | Protects the nightly stats job |
| `APP_BASE_URL` | no | Vercel, `.env.local` **and** judge repo secret | e.g. `https://mentor-portal-taupe.vercel.app` |

The judge repo (GitHub → `mentor-portal-judge` → Settings → Secrets and variables → Actions) has exactly two
secrets: `JUDGE_WEBHOOK_SECRET` and `APP_BASE_URL`.

To make a long random secret, run this in your own terminal (not in a chat):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Rotating secrets

Do it when a secret may have leaked, when someone who knew it leaves, or when it expires.

**GitHub judge token (expires: keep a calendar reminder a week before).**
1. GitHub → your profile picture → Settings → Developer settings → Personal access tokens → Fine-grained
   tokens → **Generate new token**: resource owner `AnshMick27`, only `mentor-portal-judge`,
   **Contents: Read and write**, an expiry date.
2. Put it in Vercel as `GITHUB_JUDGE_TOKEN` (and `.env.local`), then **Redeploy**.
3. Submit one coding answer as a test student; it should be judged within a couple of minutes.
4. Delete the old token on GitHub.

If the token has already expired, students see "We could not start the judge right now…" and the Vercel log
says `GitHub refused the judge dispatch (HTTP 401)`. Their attempts are not counted, so nothing is lost.

**`JUDGE_WEBHOOK_SECRET`.** Make a new value, set it in the judge repo's Actions secret **and** in Vercel at
the same time, then Redeploy. Judge runs that finish during the switch are refused and shown to the student as
"not counted"; they can submit again.

**`CRON_SECRET`.** Set a new value in Vercel and Redeploy. Vercel sends it to the cron job by itself.

**Firebase service account key.** Firebase console → Project settings → Service accounts → **Generate new
private key**. Copy `project_id`, `client_email` and `private_key` into Vercel and `.env.local`, Redeploy, check
that sign-in works, then delete the old key in Google Cloud console → IAM → Service accounts → Keys. Keep the
JSON file outside the project folder and delete it once copied.

**AI key.** Create a new key in the provider's console, set `GROQ_API_KEY` / `GEMINI_API_KEY` /
`ANTHROPIC_API_KEY` in Vercel, Redeploy, submit one intro as a test, then revoke the old key.

---

## 4. Adding a coding problem

1. In the **judge repo** (never in `mentor-portal`): create `problems/<slug>/problem.json`
   (`{ "timeLimitMs": 2000, "memoryMb": 256 }`) and the hidden tests `problems/<slug>/tests/01.in`, `01.out`,
   `02.in`, `02.out`, … The slug is lowercase with dashes, e.g. `two-sum`. Commit and push.
2. Optional check without the portal: the "Test without the portal" command in the judge repo's `README.md`.
3. In the portal, as mentor: **Manage tasks → New task**, type **Coding**, the **same slug**, languages,
   1–5 sample tests (shown to students), time limit, due date; publish.
4. Submit a correct and a wrong answer as a test student.

Once anyone has submitted, a task's type and problem slug are locked; to change them, create a new task.

---

## 5. Routine jobs

- **Nightly stats** run at 00:30 IST (Vercel cron `/api/cron/recompute`) so missed deadlines are counted.
  Run it by hand after fixing data: Vercel → Settings → **Cron Jobs → Run**. Its log line reads
  "Nightly stats recompute: N students, M tasks".
- **Excel export**: `/mentor` → **Export Excel** (mentor and viewer).
- **Leaderboard**: off by default; switch at the bottom of `/mentor`.

---

## 6. When something goes wrong

Look at Vercel → the project → **Logs** first: every API error is logged there with details the user never sees.

| Symptom | Likely cause | Fix |
|---|---|---|
| Coding submission says "We could not start the judge right now" | Judge token expired or wrong; `GITHUB_JUDGE_*` missing | Logs show `Judge is not configured` or `GitHub refused the judge dispatch (HTTP …)`; see §3 |
| Coding submission stays "Waiting" then "not counted" after 10 min | Judge run failed or its callback was refused | GitHub → judge repo → **Actions** → the run: `run` job failed = harness problem; `report` job 401 = `JUDGE_WEBHOOK_SECRET` differs; connection error = `APP_BASE_URL` wrong |
| Resume/intro: "We could not get AI feedback right now" | AI provider down, key revoked, or quota used up | Logs name the provider error; check the provider's console; the attempt was not counted |
| A dashboard says "Could not load…" | A Firestore index is missing or still building | Firebase console → Firestore → Indexes; redeploy indexes (§1) |
| "Please sign in with your college email." | Signed in with a personal Gmail | Use the college account |
| Sign-in popup fails on a new domain | Domain not authorised in Firebase | Firebase console → Authentication → Settings → Authorized domains → add it |
| Someone should be a mentor/viewer | Not in the email lists | Add to `MENTOR_EMAILS`/`VIEWER_EMAILS`, Redeploy, they sign in again |
| A mentor/viewer should lose access | Sign-in only ever upgrades roles | Remove them from `MENTOR_EMAILS`/`VIEWER_EMAILS` and Redeploy, then in Firestore set their `users/{uid}` `role` to `student` |
| Student typed the wrong roll number or branch | Onboarding is one-time | Firestore → `users/{uid}`: fix `rollNo`/`branch`, then run the cron by hand (§5) so stats follow |
| Stats look out of date | A recompute failed, or a manual data fix | Run the cron by hand (§5) |
| Browser console says "Refused to load … Content Security Policy" | A new outside script/host is not in the CSP | Add it in `lib/security/headers.ts`, run `npm run check`, deploy |

---

## 7. Free-tier limits to watch

Check these once a week while the batch is active, and before announcing big tasks:

- **Firestore (Spark plan):** Firebase console → **Usage**. Daily free quota is about 50,000 reads and 20,000
  writes. Dashboards read precomputed stats; the biggest single cost is the Excel export (about one read per
  finished submission) and the nightly job (one read per user, task and submission).
- **GitHub Actions minutes** for the private judge repo: GitHub → Settings → Billing. Each coding attempt is one
  short run; attempt limits keep usage down.
- **Vercel Hobby:** Vercel → Usage (function time and bandwidth).
- **AI provider:** its own dashboard; set a spending limit if the plan is paid.

Limits change; check the providers' pricing pages for the current numbers.

---

## 8. Backups

The free Spark plan has **no automatic Firestore backups**, and managed exports
(`gcloud firestore export`) need the paid Blaze plan plus a Cloud Storage bucket.

- At least weekly, and at the end of the batch, download the **Excel export** from `/mentor`: it holds every
  student's stats, best scores and all finished results (not the submitted text or code).
- If a full backup ever matters (e.g. before deleting anything), switch the project to Blaze for a day, run a
  managed export, then switch back. Ask Claude to walk you through it.

---

## 9. Useful commands

| Command | What it does |
|---|---|
| `npm run check` | Everything that must pass before a commit |
| `npm run build` | Production build (what Vercel runs) |
| `npm run dev` | Local app at http://localhost:3000 |
| `npm run emulators` | Local Auth + Firestore emulators (demo data only) |
| `npm run seed` | Load demo data into the running emulators |
| `firebase deploy --only firestore:rules,firestore:indexes` | Deploy security rules and indexes |
| `firebase firestore:indexes` | List the indexes deployed to the real project |
| `git push` | Deploy (Vercel builds `main`) |
