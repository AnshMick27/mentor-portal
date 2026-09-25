# CDC Mentor Portal

Placement-prep portal for final-year students. See `SPEC.md` for the full specification and `PROGRESS.md` for status.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | Generate Next.js route types, then `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests (vitest) |
| `npm run test:rules` | Firestore rules tests (placeholder until T4) |
| `npm run check` | typecheck + lint + test + test:rules — must pass before every commit |
