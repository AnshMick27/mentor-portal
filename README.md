# CDC Mentor Portal

Placement-prep portal for final-year students. See `SPEC.md` for the full specification and `PROGRESS.md` for status.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill it in (see comments in the file)
npm run dev                  # http://localhost:3000
```

## Run against the emulators (local demo data)

Nothing here touches the real Firebase project: the app, the seed script and all data run on your machine.
Needs Java 21 on the PATH (the Firebase emulators are Java programs).

1. In `.env.local` set `NEXT_PUBLIC_USE_EMULATOR=true` and make sure `ALLOWED_EMAIL_DOMAIN` and
   `FIREBASE_ADMIN_PROJECT_ID` are filled in. (The emulator switch is ignored in production builds.)
2. Terminal 1 — start the Auth and Firestore emulators and leave them running:
   ```bash
   npm run emulators
   ```
3. Terminal 2 — load the demo data (safe to run again; it resets the demo users and tasks):
   ```bash
   npm run seed
   ```
   It prints the demo accounts: `demo.mentor@…`, `demo.viewer@…` and `demo.student1@…` to `demo.student6@…`
   (on your `ALLOWED_EMAIL_DOMAIN`), and 4 tasks: 2 published, 1 draft, 1 past due.
   The script refuses to run if the emulator host variables point anywhere other than this machine.
4. Terminal 2 — start the app:
   ```bash
   npm run dev
   ```
5. Open http://localhost:3000/login and click **Sign in with Google**. The emulator shows its own sign-in window
   (no real Google account is used):
   - pick one of the listed demo accounts to sign in as that mentor, viewer or student, or
   - click **Add new account** and enter a new email on your domain to test first login and onboarding as a new student.
6. Emulator data is lost when you stop the emulators (Ctrl+C). Start them again and re-run `npm run seed`.

To go back to the real project, set `NEXT_PUBLIC_USE_EMULATOR=false` and restart `npm run dev`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | Generate Next.js route types, then `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests (vitest) |
| `npm run test:rules` | Firestore rules tests (starts a temporary Firestore emulator) |
| `npm run check` | typecheck + lint + test + test:rules — must pass before every commit |
| `npm run emulators` | Start the local Auth + Firestore emulators |
| `npm run seed` | Load demo data into the running emulators (emulator only) |
