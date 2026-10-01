# UX review: CDC Mentor Portal (T35)

Reviewed: 2026-10-01, by the design agent in review mode (no code was changed). Line numbers point at the code as of
commit `71284bc`.

## 1. Summary

The portal is in good functional shape. Copy is mostly plain, warm and specific. Dates go through `formatIst`
everywhere. Most controls already have `min-h-11` and a focus ring. Nearly every list has an empty state. The biggest
problems are structural, not cosmetic:

- **Navigation.** There is no navigation between pages. A student on `/student/tasks` has no way back to their home
  screen, and the header logo sends signed-in users to the public landing page, which shows a "Sign in" button.
- **Dark mode.** It is only half done. There is no `color-scheme`, so native controls stay light. The blue focus ring
  falls under 3:1 on the dark background. Form-field borders and the switch track are under 3:1 in both themes.
- **Student home screen.** The order is wrong for students: "This week" comes below the stats card and a 240 px
  chart, so on a 360 px phone students scroll before they see what is due.
- **Repeated styling.** About 15 hand-copied button, card, note and link class strings have drifted apart (border
  `/15` vs `/20`, `disabled:opacity-50` vs `60`, `px-4` vs `px-5`). Collapsible rows (`<details>`) show no expand
  arrow on Android Chrome.

None of the fixes below need a data or API change, except where marked **out of scope**.

---

## 2. Findings, ranked by impact

Legend: **Impact** H = blocks or confuses many users, M = noticeable friction or an accessibility failure on some
screens, L = polish.

### UX-01 (H): No navigation between pages; the header logo leads signed-in users to the "Sign in" page
- **Where:** `components/AppHeader.tsx:12` (`<Link href="/">`), `components/student/StudentTaskBoard.tsx:45-53` (no
  link back), `app/mentor/tasks/page.tsx` / `components/tasks/TaskList.tsx:24` (no link back to the dashboard),
  `app/page.tsx:10-15`, `app/privacy/page.tsx:85` ("Back to the portal" → `/`).
- **Problem:** The header has only the logo and "Sign out". The logo goes to `/`, the public landing page, whose only
  action is "Sign in". From `/student/tasks` a student cannot reach `/student` except through
  `/` → "Sign in" → `/login` → redirect. Mentors on `/mentor/tasks` have no way back to the dashboard. The only
  "back" links are ad hoc (see UX-17).
- **Why it matters:** Students on slow phones lose time and trust ("did it log me out?"). Mentors switch between
  Dashboard, Tasks and Students all the time.
- **Fix:** Add a role-aware `<nav aria-label="Main">` to `AppHeader` (the profile prop is already there):
  - Students: "Home" (`/student`) and "My tasks" (`/student/tasks`).
  - Mentors and viewers: "Dashboard" (`/mentor`), "Tasks" (`/mentor/tasks`) and "Students" (`/mentor/students`).
  - Mark the current page with `aria-current="page"` (`usePathname()`). Current link classes:
    `font-semibold text-foreground underline decoration-2 underline-offset-8`. Other links: `text-muted`.
  - Every link: `inline-flex min-h-11 items-center px-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/10`.
  - Layout at 360 px: two rows. Row 1 is the brand and "Sign out". Row 2 is the nav, using
    `flex gap-1 border-t border-line` (at most 3 links, about 100 px each, so no sideways scroll).
  - Change the brand `href` to the role's home: `profile.role === "student" ? "/student" : "/mentor"`.
  - Optional: on `/`, reuse `guardRedirect("login", view)` from `lib/auth/guards.ts` in a small client child so
    signed-in visitors are sent to their home. This is a read-only use of lib.

### UX-02 (H): Dark mode does not set `color-scheme`, so native controls stay light
- **Where:** `app/globals.css:13-18`. This affects every `<select>`, `<input type="datetime-local">`,
  `<input type="file">`, checkbox, radio and scrollbar. All fields use `bg-transparent`, for example
  `components/OnboardingForm.tsx:10`, `components/tasks/TaskForm.tsx:20` and
  `components/mentor/MentorDashboard.tsx:100`.
- **Problem:** Without `color-scheme: dark`, the browser draws form controls in their light style. On desktop
  Chrome/Edge (mentors on laptops), a transparent `<select>` with `#ededed` text opens a white option list, which
  can be nearly unreadable. The calendar icon of the due-date picker is black on `#0a0a0a`. The file-picker button,
  checkboxes and radios look like they come from another app.
- **Why it matters:** Mentors create tasks (due date, type, languages) and filter by branch in exactly these
  controls. Students pick their branch at onboarding.
- **Fix:** Add `color-scheme: light dark;` to `:root` in `globals.css`. Optionally also add
  `select option { background: var(--background); color: var(--foreground); }`.

### UX-03 (H): The focus ring is too faint in dark mode and missing on several controls
- **Where:**
  - `focus-visible:outline-blue-700` with no `dark:` variant appears in about 25 places, e.g.
    `components/AppHeader.tsx:20` and `components/student/FeedbackSubmitParts.tsx:5,8`.
  - No focus classes at all on:
    - `components/QueryStatus.tsx:11` ("Try again")
    - `components/mentor/StudentProfile.tsx:134` ("Load older attempts")
    - `components/student/StudentTaskDetail.tsx:33` ("← All tasks")
    - `app/mentor/students/page.tsx:19` and `components/mentor/StudentProfile.tsx:81` ("← Dashboard")
    - `components/AppHeader.tsx:12` (brand)
    - `components/student/CodeSubmitForm.tsx:57` and `components/mentor/MentorDashboard.tsx:100` (selects)
    - `components/student/SubmissionHistory.tsx:98` ("What you sent")
    - Markdown links (`globals.css:39`)
- **Problem:** `#1d4ed8` on `#0a0a0a` is about 2.9:1, below the 3:1 that WCAG 1.4.11 needs for a focus indicator.
  Controls without the classes fall back to the browser default, so focus looks different on every screen.
- **Why it matters:** SPEC §11 requires visible focus. Keyboard users (mentors on laptops) lose their place.
- **Fix:** Use one global rule in `globals.css` instead of per-element classes:
  `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }`, with `--focus: #1d4ed8` in light mode
  and `#93c5fd` in dark mode (about 11:1). Then remove the per-element `focus-visible:outline-*` strings as each
  component moves to `components/ui/*` (UX-16).

### UX-04 (H): Student home screen: "what is due" is below the fold
- **Where:** `components/student/StudentDashboard.tsx:106-166`. The current order is h1 → `Summary` (up to 6 stats,
  3 rows at `grid-cols-2`) → "Progress" (chart `h-60`, `ProgressChart.tsx:31`) → "This week" → "Latest feedback"
  (first item expanded, `open={index === 0}`, line 147) → "Next steps".
- **Problem:** At 360 px the stats card and chart take about 520 px, so "This week" starts below the first screen.
  The newest feedback is fully expanded (score, criteria table and three lists), which pushes "Next steps" a long
  way down. SPEC §8.5 lists "My tasks this week" first.
- **Why it matters:** Design principle 5 and the students' top question ("what is due?").
- **Fix:**
  - New order: h1 → "This week" → "Next steps" → "Latest feedback" (all collapsed; the summary row already shows
    "score · date") → `Summary` stats → "Progress" → Leaderboard.
  - Make the first due task stand out: give its card `border-blue-700/40 bg-blue-50 dark:bg-blue-950/40` and add a
    "Start" or "Continue" label. That gives the screen one clear primary action.
  - Change the subtitle to "What is due this week, and how you are doing."

### UX-05 (H): Collapsible rows show no expand arrow
- **Where:**
  - `components/student/StudentDashboard.tsx:82` (`summary` with `flex … list-none`)
  - `components/student/SubmissionHistory.tsx:88` (`summary` with `flex`)
  - `components/mentor/StudentProfile.tsx:32` (`summary` with `flex flex-col`)
- **Problem:** Setting `display: flex` on `<summary>` removes the browser's disclosure arrow in Chrome and Firefox,
  and `list-none` removes it on purpose. Nothing tells the user these cards open. The mentor list at
  `MentorDashboard.tsx:57` keeps the arrow (no `flex`), so the behaviour is also inconsistent.
- **Why it matters:** Students do not discover their full feedback (criteria, what to improve). Mentors do not
  discover attempts on the profile.
- **Fix:** Build a shared `Disclosure` component (§3) whose summary ends with a chevron:
  `<span aria-hidden="true" className="ml-auto shrink-0 transition-transform group-open/disclosure:rotate-180">▾</span>`
  (named groups, because these `<details>` nest up to three deep on the profile). Optionally add text such as
  "Show feedback" / "Hide feedback" for students.

### UX-06 (M): Form-field borders and the switch track are below 3:1 contrast
- **Where:**
  - Field borders `border-black/20` and `dark:border-white/25`: `OnboardingForm.tsx:10`, `TaskForm.tsx:20`,
    `FeedbackSubmitParts.tsx:5`, `CodeSubmitForm.tsx:57`, `MentorDashboard.tsx:100`, `StudentList.tsx:84`.
  - Switch track `bg-black/25` and `dark:bg-white/25`: `components/leaderboard/LeaderboardParts.tsx:65`.
- **Problem:** `black/20` on white is about `#ccc`, 1.6:1. `white/25` on `#0a0a0a` is about 2.2:1. The switch's off
  track (`#bfbfbf`) is about 1.8:1, so the white thumb nearly disappears. WCAG 1.4.11 needs 3:1 for the boundary of
  a control.
- **Why it matters:** On sunlit phone screens students cannot see where to type, or whether the leaderboard switch
  is on or off.
- **Fix:**
  - Add a `--line-strong` token: `rgb(0 0 0 / 0.45)` in light mode (about 3.4:1) and `rgb(255 255 255 / 0.4)` in
    dark mode (about 3.8:1). Use it as `border-line-strong` on every field.
  - Switch track: `bg-black/50 dark:bg-white/45`.
  - Keep `border-black/10` for decorative card borders; those do not need 3:1.

### UX-07 (M): Task cards have no status chip, and "Submitted" hides tasks students can still improve
- **Where:** `components/student/StudentTaskBoard.tsx:6-24` (TaskCard) and
  `components/student/StudentDashboard.tsx:63-70` (WeekTask). Grouping comes from `lib/tasks/studentBoard.ts:51-53`.
- **Problem:** A task with 1 of 3 attempts used and a 3.0 score moves to "Submitted". Its card says only
  "Attempts: 1 of 3 used · Best 3.0 / 10". Nothing says "you can still try again before <date>". "Due soon" cards
  show an absolute date only. The status is not visually distinct; on the board, only the group heading conveys it.
- **Why it matters:** Retrying is the main way students improve. Scanning for "what still needs me" is the
  students' main job on this page.
- **Fix:**
  - Add a `StatusChip` (§3) at the top right of each card. Use the same `flex items-start justify-between` layout as
    `TaskList.tsx:41`.
  - Chips:
    - `Not started` (warning) when 0 attempts and still open.
    - `Can improve · 2 tries left` (info) when submitted, open and attempts left.
    - `Done` (success) when there are no attempts left or Accepted.
    - `Missed` (danger) in the Missed group.
    - `Closed` (neutral) when past due after submitting.
  - Add a relative due time next to the IST date: "Due in 2 days (5 Oct, 11:59 pm IST)". Write it as a small pure
    helper in `components/ui/` with a test.
  - **Out of scope for the design agent:** moving "submitted but still open with attempts left" tasks into
    "Due soon" changes `groupStudentTasks` in `lib/`. This is a main-loop task if Ansh wants it.

### UX-08 (M): After submitting code, the live status is a long scroll away
- **Where:** `components/student/CodeSubmitForm.tsx:93-96` ("Sent to the judge. Watch the status under 'Your
  attempts' below.") and `components/student/StudentTaskDetail.tsx:66-67`.
- **Problem:** The status for queued, running and done appears only in "Your attempts", below a 16-row code box
  (`rows={16}`, line 75). On a phone the student must scroll down and wait without knowing where to look.
- **Why it matters:** This is the main moment of the coding flow. Students will submit again, thinking it failed.
- **Fix:** In `CodeSubmitSection` (`TaskSubmitSection.tsx:27`), pass the newest attempt (already in `submissions` on
  the page) and render the same `JudgeStatus` block directly under the Submit button while
  `state.status === "sent"`. It updates live, because `submissions` comes from the snapshot listener. Keep the line
  "Full details are under 'Your attempts' below." This is presentation only.

### UX-09 (M): A successful feedback submit can be shown as a red error
- **Where:** `components/student/useFeedbackSubmit.ts:38-40` sets `{status: "error", message: "Your feedback is
  saved. See 'Your attempts' below."}`. `FeedbackSubmitParts.tsx:34` renders it with `ErrorNote` (red,
  `role="alert"`).
- **Problem:** If the reply does not parse, a success message is shown in an error box.
- **Why it matters:** Students think the attempt failed and use another attempt.
- **Fix:** Add a `{status: "saved"}` state and render it as `<Note tone="success">` with the copy "Your feedback is
  ready. You can read it under 'Your attempts' below." (component-only change).

### UX-10 (M): No warning before the last attempt; disabled Submit buttons give no reason
- **Where:**
  - `components/student/TaskSubmitSection.tsx:15-21` (`AttemptsLeft`, plain `text-sm opacity-80`)
  - `ResumeSubmitForm.tsx:86` (disabled when empty)
  - `CodeSubmitForm.tsx:90` (disabled when empty)
  - `IntroSubmitForm.tsx:44` (disabled under 300 characters)
  - Both use `disabled:opacity-50` (`FeedbackSubmitParts.tsx:8`).
- **Problem:** "1 attempt left. Your best score counts." looks the same as "3 attempts left". A greyed-out button
  with no explanation reads as "broken".
- **Why it matters:** Students cannot undo using up their last attempt, and English is a second language for most
  of them.
- **Fix:**
  - When `attemptsLeft === 1`, show `<Note tone="warning">This is your last attempt. Check your work before you
    submit.</Note>`.
  - Under a disabled button, add `<p className="text-sm text-muted">` with the reason:
    - Code: "Paste or type your code to submit."
    - Resume: "Add your resume text (or choose a PDF) to submit."
    - Intro: the existing `charError`.
  - Link it with `aria-describedby`.

### UX-11 (M): Heading order is broken in feedback and task descriptions
- **Where:**
  - `components/student/SubmissionResultView.tsx:8,35` use `<h4>` directly under an `<h2>` section ("Your
    attempts", "Latest feedback", "Tasks" on the profile), so the h3 level is skipped.
  - `components/Markdown.tsx` passes mentor `#` headings through as `<h1>`. `globals.css:34` sizes them at
    1.375 rem, almost the page title's `text-2xl`.
- **Problem:** Screen-reader heading navigation jumps levels. A mentor's `# Problem` creates a second h1 that
  competes visually with the task title.
- **Why it matters:** SPEC §11 (headings in order). The page hierarchy also gets confusing.
- **Fix:**
  - In `SubmissionResultView`, use `<h3>` (or a `headingLevel` prop defaulting to 3).
  - In `Markdown`, map `h1` and `h2` to `<h3 className="text-lg font-semibold">` and `h3` to `h6` to `<h4>`.
  - Wrap the description in `<section aria-labelledby>` with an `h2` "What to do" (visible or `sr-only`).

### UX-12 (M): Remove or Restore wipes the Students page and its search box
- **Where:** `app/mentor/students/page.tsx:23` (`onChanged={reload}`), `components/useAsyncData.ts:30-33` (`reload`
  sets `{status: "loading"}`), and the same pattern on `app/mentor/students/[uid]/page.tsx:78`.
- **Problem:** After a removal, the whole list is replaced by "Loading…". The search text (state inside
  `StudentList`) and the scroll position are lost. On the profile, the older attempts already loaded are dropped.
- **Why it matters:** A mentor cleaning up the class removes several people in a row and has to search again each
  time.
- **Fix:** Add a `refresh()` to `useAsyncData` that keeps the current data while fetching (a `refreshing` flag), and
  use it for `onChanged`. Optionally show `<p role="status" className="text-sm text-muted">Updating…</p>`. Move the
  search state up to the page, or keep `StudentList` mounted during the refresh. Component-only.

### UX-13 (M): Several tap targets are under 44 px
- **Where:**
  - `MentorDashboard.tsx:60-64`: student names in "not submitted", `text-sm` links in a `gap-1` list, about 20 px
    tall and stacked.
  - `TaskList.tsx:43-48`: only the task title text is the link.
  - Back links: `StudentTaskDetail.tsx:33`, `students/page.tsx:19`, `StudentProfile.tsx:81`.
  - `StudentDashboard.tsx:91,121`: "Open task" and "All tasks".
  - `SubmissionHistory.tsx:98`: the "What you sent" summary has no `min-h-11`.
  - `TaskForm.tsx:119`: Write/Preview tabs are `min-h-9` (36 px).
  - `SiteFooter`: the privacy link.
- **Problem:** Small, closely stacked targets cause wrong taps on phones.
- **Why it matters:** Principle 1, and mentors on phones scanning ~50 names.
- **Fix:**
  - Standalone links: `inline-flex min-h-11 items-center`.
  - Make the whole mentor task card a link, like `StudentTaskBoard.tsx:9-12`.
  - Not-submitted list: `<li className="flex min-h-11 items-center gap-2">`.
  - `summary`: `min-h-11 flex items-center`.
  - Tabs: `min-h-11`.

### UX-14 (M): A full-width "Remove from portal" button is on every student card at 360 px
- **Where:** `components/mentor/StudentList.tsx:26-30`. The wrapper `div.shrink-0` stretches in the `flex-col` `li`,
  so the button inside `RemoveStudentButton.tsx:40-55` (`flex flex-col`) is full width. Also
  `StudentProfile.tsx:88` puts Remove directly under the name, above the stats.
- **Problem:** On a phone the destructive action is the largest thing on each of about 50 cards, and the first
  control on a profile.
- **Why it matters:** It invites mis-taps (there is a confirm step, but it still adds noise) and draws attention
  away from the student's work.
- **Fix:**
  - List: add `self-start` to the wrapper (`className="shrink-0 self-start sm:max-w-xs"`) and to the buttons.
  - Profile: move `actions` into a final `<Section title="Access">` at the bottom with the line "Remove this student
    if they are not your mentee. Their work is kept."

### UX-15 (M): Secondary text uses `opacity-*`, which also dims links below AA
- **Where:**
  - `components/PrivacyLink.tsx:20`: `AiDataNote` is `opacity-80` and contains the blue `PrivacyLink`.
  - `components/auth/LoginPanel.tsx:48`: same pattern.
  - `opacity-60` to `opacity-80` is used for secondary text in about 40 places.
- **Problem:** `#1d4ed8` at 80% opacity on white is about 4.4:1, below 4.5:1 for `text-sm`. Opacity stacks
  unpredictably when nested, and any coloured child gets dimmed too.
- **Why it matters:** AA in both themes is a hard requirement (principle 2). The privacy link is the one link
  students need to trust the AI step.
- **Fix:** Add a `--muted` token (`#525252` light, about 7.8:1; `#a3a3a3` dark, about 8:1) exposed as `text-muted`.
  Replace `opacity-70`, `opacity-75` and `opacity-80` on text with `text-muted`. Never put a link inside an
  `opacity-*` element.

### UX-16 (M): Buttons are styled six different ways
- **Where:**
  - Primary: `app/page.tsx:12`, `LoginPanel.tsx:44`, `OnboardingForm.tsx:74`, `FeedbackSubmitParts.tsx:7`
    (`disabled:opacity-50`), `TaskForm.tsx:277` (`disabled:opacity-60`), `TaskList.tsx:29` (`px-4`, others `px-5`),
    `app/mentor/page.tsx:30`.
  - Secondary: `AppHeader.tsx:20` (`border-black/15 text-sm`), `TaskForm.tsx:23` (`border-black/15 text-sm`),
    `app/mentor/page.tsx:36` (`border-black/20`, base size), `ExportButton.tsx:38`, `RemoveStudentButton.tsx:11`,
    `StudentProfile.tsx:134` (no hover), `QueryStatus.tsx:11` (`border-current`, no hover).
- **Problem:** The same action looks different from screen to screen.
- **Why it matters:** Principle 3. Students learn "blue = do it" only if blue always means the same thing.
- **Fix:** Use `Button` / `ButtonLink` / `buttonClasses()` in `components/ui/Button.tsx` (§3) and replace every
  string listed above.

### UX-17 (M): Back links are inconsistent and sometimes go to the wrong place
- **Where:**
  - "← All tasks" (`StudentTaskDetail.tsx:33`, `underline`)
  - "← Dashboard" (`students/page.tsx:19`, `StudentProfile.tsx:81`, `hover:underline`)
  - "Back to your tasks" (`student/tasks/[id]/page.tsx:32`)
  - "Back to the dashboard" (`students/[uid]/page.tsx:20`)
  - "Back to tasks" as a button (`TaskForm.tsx:281`) and as a link (`MentorOnly.tsx:15`)
- **Problem:** The wording, style and destination all vary. A profile opened from `/mentor/students` goes "back" to
  `/mentor`.
- **Why it matters:** Predictable way-finding. Once UX-01 adds the header nav, these become the secondary path.
- **Fix:**
  - One `BackLink` (§3): `inline-flex min-h-11 items-center gap-1 text-sm font-medium text-link` with a `←` that
    has `aria-hidden`.
  - Profile: "← Students" (`/mentor/students`). Task page: "← My tasks". Edit task: "← Tasks".
  - Render it inside `PageHeader` so it always sits in the same spot.

### UX-18 (M): Every signed-in page has the same browser-tab title
- **Where:** Only `app/layout.tsx:7`, `app/login/page.tsx:5` and `app/privacy/page.tsx:6` set metadata. All
  `"use client"` pages share "CDC Mentor Portal".
- **Problem:** Tabs, history and screen readers ("page loaded") cannot tell pages apart.
- **Why it matters:** Mentors keep several tabs open (dashboard, a profile, the task form).
- **Fix:** React 19 hoists `<title>` from anywhere. Render it from `PageHeader` as `` `${title} · CDC Mentor
  Portal` ``. Examples: "My tasks · …", the task title, the student's name, "Edit task · …".

### UX-19 (M): Intro and code form order; live counters announce every keystroke
- **Where:**
  - `IntroSubmitForm.tsx:35`: `<AiDataNote />` sits between the textarea and its own counter (line 36).
  - `ResumeSubmitForm.tsx:60` puts it above the text. `CodeSubmitForm.tsx:83` puts the instructions *after* the
    16-row box.
  - `aria-live="polite"` on `#intro-count` (line 36), `#resume-count` (line 82) and `#code-size` (line 86).
- **Problem:** The counter is visually separated from the field it counts. Screen readers read "143 words…" after
  every pause. The coding instructions ("Read input from standard input…") come after the field, and "Esc then
  Tab" means nothing on a phone.
- **Fix:**
  - Order in all three forms: label → hint → field → counter → `AiDataNote` → Submit.
  - Remove `aria-live` from the counters (keep `aria-describedby`). Add one `sr-only` `role="status"` that only
    changes when a limit is crossed ("Too long", "In the target range").
  - Code hint: put "Read the input from standard input and print the answer." above the box. Keep the Tab/Esc line
    as a second sentence with `hidden sm:inline`.

### UX-20 (M): Viewers hit a dead end on the task list (needs Ansh's decision)
- **Where:** `app/mentor/page.tsx:32` ("View tasks") → `TaskList.tsx:49-50` (titles are plain text for viewers);
  `MentorOnly.tsx:11-18` blocks `/mentor/tasks/[id]`.
- **Problem:** CDC leadership can open "View tasks" but cannot read any task's description.
- **Fix:** A read-only task view (title, type, due date, rendered `Markdown`, samples) on `/mentor/tasks/[id]` for
  viewers. `GET /api/tasks/[id]` already allows `["mentor", "viewer"]`
  (`app/api/tasks/[id]/route.ts:14`), so no API change is needed. It does change what viewers see in the UI, so ask
  Ansh first. Until then, rename the button to "Task list" so it does not promise more.

### UX-21 (M): Task form gaps (mentors)
- **Where:** `components/tasks/TaskForm.tsx`.
- **Problem:**
  1. The tabs (line 111-126) have `role="tab"` but no `tabpanel`, `aria-controls` or arrow-key support, and are
     36 px tall.
  2. "Back to tasks" (line 281) throws away unsaved edits without asking.
  3. After "Create task" the page jumps to the list (line 79) with no confirmation.
  4. Only the first validation issue is shown (line 68), and it is not tied to its field.
  5. The "Remove" button on each sample (line 215-221) has no context for screen readers.
  6. Required fields are not marked.
- **Fix:**
  1. Replace the tabs with two `aria-pressed` toggle buttons (`min-h-11`), or a "Show preview" checkbox. Simpler
     and honest.
  2. Keep a `dirty` flag. While it is set, the back control asks "Leave without saving?" (inline confirm, as in
     `RemoveStudentControls`).
  3. Push `/mentor/tasks?created=1`. The list shows `<Note tone="success">Task created.</Note>` (read via
     `useSearchParams`), or stay on the edit page.
  4. Show the message and focus the first invalid field. Set `aria-invalid` and `aria-describedby` on it (zod issue
     `path[0]` maps to the field).
  5. `aria-label={`Remove sample ${index + 1}`}`.
  6. Add "(required)" to the labels for title, description and due date.

### UX-22 (M): Mentor dashboard priorities
- **Where:** `app/mentor/page.tsx:27-44`, `components/mentor/MentorDashboard.tsx:111-141`,
  `components/mentor/LeaderboardSetting.tsx:56`.
- **Problem:**
  - Three equal-weight header actions (Manage tasks, Students, Export Excel) wrap onto two rows at 360 px.
  - "Needs attention", the list a mentor acts on, comes after a long "Task status" list.
  - The leaderboard card is styled differently from every other section (the `<section>` itself is the card, with
    the h2 inside) and sits outside the `gap-8` stack.
- **Fix:**
  - Once the UX-01 nav exists, keep only "Export Excel" in the header (secondary).
  - Order: "Needs attention" → "Task status" → "Class overview" → "Student leaderboard" (the order is a product
    choice; SPEC §8.6 lists Task status first, so confirm with Ansh).
  - Render `LeaderboardSetting` with the shared `Section` + `Card`.

### UX-23 (M): Task page header gives no quick status and no shortcut to submit
- **Where:** `components/student/StudentTaskDetail.tsx:36-45`.
- **Problem:** The type, due date, attempts and best score are two `text-sm opacity-80` lines. On a long
  description the submit form is several screens down.
- **Fix:**
  - Header: h1, then the `StatusChip` from UX-07, then one meta line, "Coding · Due in 2 days (5 Oct, 11:59 pm
    IST)", then "Best score 6.0 / 10 · 1 of 3 attempts used".
  - When submitting is open, add an in-page link `<a href="#submit-heading">Go to submit</a>` styled as
    `ButtonLink variant="secondary" size="sm"`.

### UX-24 (L): Chart legend text fails contrast; scores formatted inconsistently
- **Where:**
  - `components/student/ProgressChart.tsx:51`: recharts colours the legend text with the line colour.
  - Inconsistent score formatting: `StudentDashboard.tsx:43` vs `:45`, `MentorDashboard.tsx:148`,
    `LeaderboardParts.tsx:29`.
- **Problem:** Green `#16a34a` text (about 3.3:1) and orange `#ea580c` (about 3.6:1) at 13 px on white are below AA.
  Average shows as "6.4 / 10" while skill averages and class averages show "6.4".
- **Fix:**
  - Legend: `formatter={(value) => <span className="text-foreground">{value}</span>}`.
  - Use one `Score` helper/component: `6.4` in large text with `/ 10` in `text-muted`, everywhere a score is shown.

### UX-25 (L): Empty states and section spacing are inconsistent
- **Where:**
  - `TaskList.tsx:36` (`opacity-70` without `text-sm`, no call to action).
  - `StudentLeaderboard` / `LeaderboardSetting` render outside the page's `gap-8` stack (`app/student/page.tsx:19-20`,
    `app/mentor/page.tsx:43-44`), so they get `gap-6` instead.
  - Sections use both `aria-label` and a visible `h2` (e.g. `StudentDashboard.tsx:18`, `MentorDashboard.tsx:26`),
    so screen readers announce the name twice.
- **Fix:**
  - An `EmptyState` component, e.g. for mentors: "No tasks yet." plus "Create your first task" for mentors.
  - The page owns one `flex flex-col gap-8` stack.
  - `Section` uses `aria-labelledby={useId()}` instead of `aria-label`.

### UX-26 (L): Loading replaces the whole page, including its heading
- **Where:** `components/QueryStatus.tsx:6` → `LoadingScreen` (`RouteGuard.tsx:40-45`). Used before the h1 renders
  on every data page.
- **Problem:** On slow networks students see a blank "Loading…" with no context, and the layout jumps when content
  arrives.
- **Fix:**
  - Render the `PageHeader` (static title) outside the loading branch and show `LoadingScreen` only for the body.
  - Copy: "Loading your tasks…" / "Loading the dashboard…" (pass `label` to `QueryStatus`).
  - The error box keeps "Try again" as `Button variant="secondary"`.

### UX-27 (L): Login page lacks context; the landing page is an extra tap
- **Where:** `components/auth/LoginPanel.tsx:31-33`, `app/page.tsx`.
- **Problem:** `/login` says only "Sign in". The portal name and purpose appear only on `/`, which is one more page
  load on slow networks.
- **Fix:**
  - Above the h1 on `/login`: `<p className="text-sm font-semibold text-muted">CDC Mentor Portal</p>`.
  - Under it: "Tasks, feedback and progress for your placement preparation."
  - Optional: on `/`, label the button "Sign in with Google" (the home test only checks `href="/login"`).

### UX-28 (L): Onboarding errors are not tied to their field
- **Where:** `components/OnboardingForm.tsx:66-70` (one alert under the form). Inputs have no `aria-invalid` or
  `aria-describedby`.
- **Fix:**
  - Put the message under the field it belongs to (zod issue `path[0]`), set `aria-invalid="true"` and link it with
    `aria-describedby`.
  - Add a hint under the roll number: "As printed on your college ID card." (replace with the real source if it is
    different).

### UX-29 (L): Markdown links and images
- **Where:** `components/Markdown.tsx:13-17`, `globals.css:27-57`.
- **Problem:**
  - Links open in a new tab without saying so.
  - A mentor-pasted image (`![](…)`) has no max width, so it can overflow at 360 px. The CSP also blocks external
    images, so they appear broken.
- **Fix:**
  - Add `<span className="sr-only"> (opens in a new tab)</span>` inside the link.
  - Add `.markdown img { max-width: 100%; height: auto; }`.
  - Optionally map `img` to a short note: "Image not shown. Ask your mentor for the file."

### UX-30 (L): No skip link
- **Where:** `components/auth/RouteGuard.tsx:30-31` (header, then `main` with no `id`).
- **Fix:**
  - Add `<a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10
    focus:rounded-lg focus:bg-background focus:px-4 focus:py-2">Skip to content</a>` before the header.
  - Add `id="main"` to `main`. This matters more once the UX-01 nav exists.

### UX-31 (L): Profile meta line and removed state
- **Where:** `components/mentor/StudentProfile.tsx:85-87` (roll, branch and email on one `break-words` line) and
  `:91-96` (the removed note looks like any neutral box).
- **Fix:**
  - Show the email on its own line with `break-all`.
  - Show `StatusChip tone="danger"` "Removed" next to the h1. The same chip goes on removed rows in `StudentList`;
    the "Onboarding not finished" text at `StudentList.tsx:24` becomes a `warning` chip.

### UX-32 (L): Copy polish
- **Where and fix:**
  - Code Submit button `CodeSubmitForm.tsx:91`: "Submit" → "Submit code" (matches "Submit for feedback").
  - `StudentTaskBoard.tsx:48`: "Your tasks" → "My tasks" (matches the nav).
  - `StudentDashboard.tsx:67`: "Being checked…" → "Being checked. Open the task to see the status."
  - `MentorDashboard.tsx:73`: "No numbers yet: they appear after the first submission or tonight's update." → "No
    numbers yet. They appear after the first submission, or after tonight's update."
  - `LeaderboardSetting.tsx:63`: keep the switch label stable ("Show the leaderboard to students") and let the
    switch carry on/off. Right now the label text flips between "Leaderboard is on" and "…off" on top of
    `aria-checked`.

---

## 3. Shared tokens and components to extract

### 3.1 Design tokens (`app/globals.css`)

```css
:root {
  color-scheme: light dark;
  --background: #ffffff;  --foreground: #171717;
  --muted: #525252;                       /* secondary text, about 7.8:1 */
  --line: rgb(0 0 0 / 0.10);              /* card borders (decorative) */
  --line-strong: rgb(0 0 0 / 0.45);       /* field borders, about 3.4:1 */
  --surface: rgb(0 0 0 / 0.04);           /* code/sample backgrounds, hover */
  --link: #1d4ed8;  --focus: #1d4ed8;
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a; --foreground: #ededed; --muted: #a3a3a3;
    --line: rgb(255 255 255 / 0.15); --line-strong: rgb(255 255 255 / 0.40);
    --surface: rgb(255 255 255 / 0.07); --link: #93c5fd; --focus: #93c5fd;
  }
}
@theme inline {
  --color-muted: var(--muted); --color-line: var(--line); --color-line-strong: var(--line-strong);
  --color-surface: var(--surface); --color-link: var(--link);
}
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
```

These give the classes `text-muted`, `border-line`, `border-line-strong`, `bg-surface` and `text-link`. Status
colours stay Tailwind palette pairs inside `StatusChip` and `Note`, so they live in one place.

### 3.2 Components (`components/ui/`)

| Component | Proposed API | Replaces the pattern in |
|---|---|---|
| `Button`, `ButtonLink`, `buttonClasses` | `variant: "primary" \| "secondary" \| "danger" \| "ghost"`, `size?: "md" \| "sm"` (both `min-h-11`), `busy?: boolean`, `busyLabel?: string`, plus native button/`Link` props. `disabled:opacity-60 disabled:cursor-not-allowed` | `app/page.tsx:12`, `LoginPanel.tsx:44`, `OnboardingForm.tsx:74`, `FeedbackSubmitParts.tsx:7-8`, `CodeSubmitForm.tsx:90`, `TaskForm.tsx:22-23,277,281`, `TaskList.tsx:29`, `app/mentor/page.tsx:30,36`, `ExportButton.tsx:38`, `RemoveStudentButton.tsx:8-11`, `QueryStatus.tsx:11`, `StudentProfile.tsx:134`, `AppHeader.tsx:20` |
| `TextLink`, `BackLink` | `TextLink({href, children, external?})`: `font-medium text-link underline-offset-2 hover:underline`. `BackLink({href, children})`: `min-h-11`, leading `←` with `aria-hidden` | `LINK` constants in `StudentDashboard.tsx:13`, `MentorDashboard.tsx:19`, `StudentList.tsx:9`, `PrivacyLink.tsx:5`; back links at `StudentTaskDetail.tsx:33`, `students/page.tsx:19`, `StudentProfile.tsx:81`, `student/tasks/[id]/page.tsx:32`, `students/[uid]/page.tsx:20`, `MentorOnly.tsx:15`, `privacy/page.tsx:85` |
| `Card`, `CardLink` | `Card({as?: "div" \| "li" \| "section", padding?: "md" \| "sm", className?})`: `rounded-lg border border-line p-4`. `CardLink({href, children})`: card plus `hover:bg-surface`, whole card clickable | `CARD` in `StudentDashboard.tsx:12`, `MentorDashboard.tsx:18`, `StudentProfile.tsx:11`; inline in `StudentTaskBoard.tsx:11`, `StudentDashboard.tsx:57`, `TaskList.tsx:40`, `StudentList.tsx:14`, `StudentLeaderboard.tsx:76`, `LeaderboardSetting.tsx:56`, `ProgressChart.tsx:30`, `StudentTaskDetail.tsx:57`, `SubmissionHistory.tsx:87`, `TaskForm.tsx:137,165` |
| `Section` | `Section({title, count?, action?, level?: 2 \| 3, children})`. Uses `aria-labelledby` (`useId`); heading `text-lg font-semibold`; `count` rendered as `text-sm font-normal text-muted` | `StudentDashboard.tsx:16`, `MentorDashboard.tsx:24`, `StudentTaskBoard.tsx:26`, `StudentList.tsx:35`, `privacy/page.tsx:10`, `StudentLeaderboard.tsx:73`, `LeaderboardSetting.tsx:56`, `StudentProfile.tsx:113`, `SubmissionHistory.tsx:114`, `TaskSubmitSection.tsx:32,56`, `StudentTaskDetail.tsx:50` |
| `PageHeader` | `PageHeader({title, subtitle?, back?: {href, label}, badge?: ReactNode, actions?: ReactNode})`. Renders `BackLink`, h1 `text-2xl font-bold tracking-tight break-words`, `<title>` | `StudentDashboard.tsx:107`, `StudentTaskBoard.tsx:48`, `StudentTaskDetail.tsx:36`, `TaskList.tsx:24`, `StudentList.tsx:72`, `StudentProfile.tsx:80`, `app/mentor/page.tsx:20`, `mentor/tasks/[id]/page.tsx:21`, `mentor/tasks/new/page.tsx:10`, `onboarding/page.tsx:10`, `privacy/page.tsx:25`, the NotFound blocks |
| `StatusChip` | `StatusChip({tone: "neutral" \| "info" \| "success" \| "warning" \| "danger", children})`: `inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold` plus a tone pair (e.g. success `bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100`). The text always carries the meaning | `StatusBadge` `TaskList.tsx:5-18`, `STATE_CLASS` `StudentProfile.tsx:13-17`, `StudentDashboard.tsx:69`, `StudentList.tsx:24`, attempt status `SubmissionHistory.tsx:93` |
| `Note` | `Note({tone: "info" \| "success" \| "warning" \| "danger" \| "neutral", title?, live?: "polite" \| "assertive", children})`. `danger` → `role="alert"`, `success`/`info` with `live` → `role="status"`; `rounded-lg border px-4 py-3 text-sm` | `QueryStatus.tsx:9`, `LoginPanel.tsx:36`, `OnboardingForm.tsx:67`, `ErrorNote` and `FeedbackReady` in `FeedbackSubmitParts.tsx:10,40`, `TaskForm.tsx:263,268`, `StudentProfile.tsx:92,99`, `JudgeStatus` tones `SubmissionHistory.tsx:16-31`, `ClosedNote` `TaskSubmitSection.tsx:23`, `RemoveStudentButton.tsx:59`, inline red lines at `ExportButton.tsx:43`, `LeaderboardParts.tsx:73`, `students/[uid]/page.tsx:66` |
| `EmptyState` | `EmptyState({children, action?: ReactNode})`: `text-sm text-muted` paragraph plus an optional link or button | about 20 `text-sm opacity-70` paragraphs, e.g. `StudentDashboard.tsx:127,139,156`, `StudentTaskBoard.tsx:33`, `MentorDashboard.tsx:113,125`, `TaskList.tsx:36`, `StudentList.tsx:54`, `SubmissionHistory.tsx:119`, `ProgressChart.tsx:23`, `LeaderboardParts.tsx:6` |
| `Field`, `inputClasses` | `Field({label, hint?, error?, required?, children: (ids) => ReactNode})`. Wires `id`, `aria-describedby` and `aria-invalid`. `inputClasses = "min-h-11 w-full rounded-lg border border-line-strong bg-transparent px-3 text-base"` | `OnboardingForm.tsx:9`, `TaskForm.tsx:19-33`, `FeedbackSubmitParts.tsx:4`, `CodeSubmitForm.tsx:57`, `MentorDashboard.tsx:100`, `StudentList.tsx:84` |
| `Disclosure` | `Disclosure({summary: ReactNode, defaultOpen?, children})`: `<details className="group/disclosure …">` with a `min-h-11` summary and a rotating chevron | `StudentDashboard.tsx:81`, `SubmissionHistory.tsx:87,97`, `StudentProfile.tsx:31`, `MentorDashboard.tsx:56` |
| `Stat`, `StatGrid` | `StatGrid({children})`: `dl` grid inside a `Card`. `Stat({label, value, note?})` | `StudentDashboard.tsx:28,40`, `StudentProfile.tsx:19,104`, `MentorDashboard.tsx:144-153` |
| `Score` | `Score({value?: number, size?: "sm" \| "lg"})` → `6.4` + `<span className="text-muted">/ 10</span>`, `—` when undefined | `StudentDashboard.tsx:43,45,65,85`, `StudentTaskBoard.tsx:19`, `StudentTaskDetail.tsx:43`, `SubmissionResultView.tsx:25`, `MentorDashboard.tsx:22`, `StudentProfile.tsx:41,107`, `LeaderboardParts.tsx:29` |

---

## 4. Proposed fix batches (most impact first; one iteration each)

Every batch keeps `npm run check` green. New `components/ui/*` components get `renderToStaticMarkup` render tests in
`tests/components/ui/`. Copy changes update only the render-test strings that check that copy.

| Batch | Title | Findings | Acceptance |
|---|---|---|---|
| **T35a** | Theme tokens, global focus ring, dark-mode controls | UX-02, UX-03 (global part), UX-29 (CSS part) | `globals.css` has `color-scheme`, the tokens in §3.1 and the `:focus-visible` rule. No visual regressions in existing tests. All tests green |
| **T35b** | Header navigation, brand link, skip link | UX-01, UX-30 | New render test for `AppHeader`: a student sees Home and My tasks, a mentor or viewer sees Dashboard, Tasks and Students; the current page has `aria-current="page"`; the brand href is the role's home; the skip link targets `#main` |
| **T35c** | `Button`, `TextLink`/`BackLink`, `Note` + replace usages | UX-16, UX-15 (links), UX-09, UX-17 | Render tests for the 3 components (variants, `busy` label, `role` per tone). No raw `bg-blue-700` button strings left outside `components/ui` (grep). The success-as-error path in `useFeedbackSubmit` is gone |
| **T35d** | `Card`, `Section`, `PageHeader`, `EmptyState`, `<title>` per page, loading under the header | UX-25, UX-18, UX-26, UX-11 (section heading part) | Render tests for the 4 components (`aria-labelledby` wiring, `<title>`, back link). Each data page keeps its h1 while loading |
| **T35e** | `Disclosure`, `StatusChip`, `Score` | UX-05, UX-24, UX-31 | Render tests: the chevron is present; chip text for each tone; `Score` shows `—` for undefined. Legend formatter in `ProgressChart` |
| **T35f** | Student home: reorder and focus on what is due | UX-04 | `studentDashboard` test asserts "This week" comes before "Progress" in the markup and that no feedback item is open by default |
| **T35g** | Task board and task page status | UX-07 (display part), UX-23, UX-32 (student copy) | Render tests: a submitted-but-open task shows "Can improve"; relative-due helper unit-tested with IST edge cases; task page shows "Go to submit" only while open |
| **T35h** | Submit forms: live judge status, last-attempt warning, disabled reasons, order, counters | UX-08, UX-10, UX-19, UX-11 (`SubmissionResultView` h3, Markdown heading map) | `codeSubmit` / `feedbackSubmit` tests: the last-attempt note appears when `attemptsLeft === 1`; the disabled reason is linked with `aria-describedby`; no `h4` without an `h3`; counters have no `aria-live` |
| **T35i** | Fields and contrast: `Field`, field borders, switch track, onboarding errors | UX-06, UX-28, UX-15 (text part) | `Field` render test (`aria-invalid`/`aria-describedby`). Grep: no `border-black/20` on inputs, no `opacity-7x/8x` on text in `components/` |
| **T35j** | Mentor screens: refresh without wipe, tap targets, Remove placement, dashboard order, task form | UX-12, UX-13, UX-14, UX-21, UX-22 | The `studentList` test keeps the search value across `onChanged`. The `taskFormLock` test still passes. Remove sits in the "Access" section on the profile. Not-submitted rows are `min-h-11` |
| **T35k** | Small polish: login context, Markdown links | UX-27, UX-29 (component part), UX-32 (mentor copy) | `home`/`privacy` tests still green; Markdown test checks the "(opens in a new tab)" text |

**Out of scope for the design agent (needs a lib change or a product decision):**
- UX-07 (grouping part): moving "submitted, still open, attempts left" tasks into "Due soon" changes
  `groupStudentTasks` in `lib/tasks/studentBoard.ts`. This is a main-loop task if Ansh wants it.
- UX-20: a read-only task view for viewers. The API already allows it, but it changes what viewers see, so Ansh
  should decide.
- UX-22 (section order): putting "Needs attention" before "Task status" differs from SPEC §8.6's order. Confirm with
  Ansh. The rest of UX-22 is in T35j.
- UX-01 (optional part): redirecting signed-in users away from `/` is a small client redirect using the existing
  `guardRedirect`. Fine to do in T35b if Ansh agrees.
