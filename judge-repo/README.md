# mentor-portal-judge

The code judge for the CDC Mentor Portal (SPEC.md §9). This folder is a **template**: copy it into a separate
**private** GitHub repo (e.g. `mentor-portal-judge`). Hidden tests live only in that private repo, never in the
portal repo or in Firestore.

## How it works

1. A student submits code. The portal (`POST /api/judge/submit`) creates a `queued` submission and sends a
   `repository_dispatch` of type `judge` to this repo with:

   ```json
   { "submissionId": "abc123", "problemSlug": "sum-two-numbers", "language": "cpp", "codeB64": "<base64 source>" }
   ```

2. Job **`run`** checks out this repo (read-only token, credentials not kept, no secrets) and runs
   `scripts/run.sh`. The harness compiles and runs the code **inside Docker**, once per test:
   `--network none --memory 256m --cpus 1 --pids-limit 64 --read-only --tmpfs /tmp`, unprivileged user, no
   capabilities. Each test's input is piped to stdin; expected outputs are never mounted into the container.
   Output is compared ignoring trailing whitespace (and trailing blank lines, CRLF vs LF). It stops at the first
   failing test.
3. Job **`report`** (no checkout, never runs submitted code) signs the result with HMAC-SHA256 using
   `JUDGE_WEBHOOK_SECRET` and POSTs it to `${APP_BASE_URL}/api/judge/callback`. It also runs when `run` crashed or
   timed out, and then reports an internal error so the student can try again.

| Language | Image                | Source file | Compile / run                                   |
| -------- | -------------------- | ----------- | ----------------------------------------------- |
| `cpp`    | `gcc:13`             | `Main.cpp`  | `g++ -O2 -std=c++17`                            |
| `java`   | `eclipse-temurin:21` | `Main.java` | `javac`, then `java Main` (class must be `Main`) |
| `python` | `python:3.12-slim`   | `main.py`   | syntax check, then `python3`                    |

## Callback contract (the portal's T17 validates exactly this)

`POST ${APP_BASE_URL}/api/judge/callback`

Headers:

- `content-type: application/json`
- `x-judge-signature: sha256=<hex>`: lowercase hex HMAC-SHA256 of the **raw request body bytes**, keyed with
  `JUDGE_WEBHOOK_SECRET`. Verify over the raw body before parsing JSON.

Body: one of

```jsonc
// The judge ran (whatever the verdict)
{
  "submissionId": "abc123",
  "status": "done",
  "judge": {
    "passed": 1,                 // tests passed before stopping (0 for a compilation error)
    "total": 3,                  // number of tests for the problem (>= 1)
    "verdict": "Wrong Answer",   // "Accepted" | "Wrong Answer" | "Time Limit Exceeded" | "Runtime Error" | "Compilation Error"
    "firstFailedTest": 2         // 1-based; present for Wrong Answer / Time Limit Exceeded / Runtime Error
  },
  "compileOutput": "Main.cpp:3:5: error: ..." // only for "Compilation Error": first 20 lines, at most 4,000 chars
}

// The judge itself failed (bad slug, missing problem, Docker failure, crashed job): attempt not counted
{ "submissionId": "abc123", "status": "error", "error": "Problem 'x' is not set up in the judge repo." }
```

`submissionId` always comes from the dispatch payload (it must match `[A-Za-z0-9_-]{1,128}`), never from the
harness output. The portal shows e.g. "Wrong Answer on test 2" from `verdict` + `firstFailedTest`.
`Runtime Error` also covers running out of memory and printing more than 1 MB.

## Adding a problem

```
problems/<slug>/problem.json      { "timeLimitMs": 2000, "memoryMb": 256 }
problems/<slug>/tests/01.in  01.out  02.in  02.out ...
```

- `<slug>` is lowercase-kebab (e.g. `two-sum`) and must equal the task's problem slug in the portal.
- `timeLimitMs` is per test (100–10,000). `memoryMb` is informational for now: every container gets 256 MB.
- Tests run in file-name order; use two-digit names (`01`, `02`, … `10`).
- Keep the portal's **sample** tests in the task description; put the **hidden** tests only here.

`problems/sum-two-numbers/` is a working example (read two integers, print their sum; test 3 catches 32-bit
overflow).

## Setup (once)

1. Create a **private** repo (e.g. `mentor-portal-judge`) and copy everything from this folder into it, including
   `.github/` and `.gitattributes` (scripts must keep LF line endings). Commit and push.
2. Repo → Settings → Secrets and variables → Actions → **New repository secret**:
   - `JUDGE_WEBHOOK_SECRET`: a long random string (e.g. `openssl rand -hex 32`), the same value as in Vercel.
   - `APP_BASE_URL`: the portal URL, e.g. `https://mentor-portal.vercel.app` (no trailing slash needed).
3. Create a fine-grained personal access token with access to **only this repo**, permission
   **Contents: Read and write** (needed for `repository_dispatch`), and an expiry date. Put it in Vercel as
   `GITHUB_JUDGE_TOKEN`, with `GITHUB_JUDGE_REPO=<owner>/mentor-portal-judge`.
4. Test without the portal (a `repository_dispatch` can't be started from the Actions page, so use the GitHub CLI):

   ```bash
   code=$(printf 'a, b = map(int, input().split())\nprint(a + b)\n' | base64 -w0)
   gh api repos/<owner>/mentor-portal-judge/dispatches -f event_type=judge \
     -f 'client_payload[submissionId]=manual-test' -f 'client_payload[problemSlug]=sum-two-numbers' \
     -f 'client_payload[language]=python' -f "client_payload[codeB64]=$code"
   ```

   The `run` job log prints `results.json`. The `report` job's callback will be refused (the portal has no
   submission `manual-test`), which is expected.

## Running the harness locally (optional, needs Docker and Python 3)

```bash
RESULTS_FILE=/tmp/results.json PROBLEM_SLUG=sum-two-numbers LANGUAGE=python \
  CODE_B64=$(printf 'a, b = map(int, input().split())\nprint(a + b)\n' | base64 -w0) \
  bash scripts/run.sh && cat /tmp/results.json
```
