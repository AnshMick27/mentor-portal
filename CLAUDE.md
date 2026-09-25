# CDC Mentor Portal

Placement-prep portal for final-year students: tasks, auto-checked coding, AI feedback on resumes and intros, mentee and mentor dashboards.

## Read first
- `SPEC.md` — the single source of truth for features, data model, security and stack.
- `PROGRESS.md` — what is done and what comes next.
- `LOOP.md` — how each build iteration works (one task per iteration).
- `NOTES.md` — gotchas learned in earlier iterations.

## Commands
- `npm run dev` — local dev server
- `npm run check` — typecheck + lint + unit tests + Firestore rules tests (must pass before any commit)
- `npm run build` — production build
- `npm run seed` — demo data into the local emulator (after T11)

## Non-negotiables (full list in SPEC.md §7)
- Clients never write to Firestore; all writes go through API routes using `requireUser`.
- Secrets only in server env vars; never `NEXT_PUBLIC_`, never in git.
- Never weaken `firestore.rules` or remove tests to make checks pass.
- Hidden test cases never reach the browser or Firestore.
- Mobile-first (360 px), dates in IST.

## Next.js version note
@AGENTS.md
