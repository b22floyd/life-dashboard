# Life Dashboard

A personal life dashboard built with Next.js, Tailwind CSS, and Supabase — tasks, habits, upcoming events, a daily journal, weight training logs, and a finance snapshot in one place.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase project credentials (found under **Project Settings → API** in the Supabase dashboard):

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

> **Key format:** Use the **legacy anon key** (starts with `eyJ...`), not the newer "publishable" key (starts with `sb_publishable_...`). The `@supabase/supabase-js` version pinned here (2.111.0) rejects the publishable format with `Invalid API key`. Only switch to publishable keys after confirming the installed `supabase-js` version supports them.

Voice-memo transcription in the Journal card also needs an OpenAI API key:

```
OPENAI_API_KEY=<your-openai-api-key>
```

This key is server-only (no `NEXT_PUBLIC_` prefix) and is only ever read inside the `transcribeAudio` Server Action — it's never sent to the browser.

Freeform workout parsing in the Weight Training card needs an Anthropic API key:

```
ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

Also server-only — read inside the `parseWorkoutText` Server Action.

The Upcoming Events card needs a Google OAuth client (Calendar API, read-only access):

```
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>
```

Create these in a [Google Cloud project](https://console.cloud.google.com/apis/credentials) with the Calendar API enabled. The redirect URI registered in Google Cloud Console must exactly match `<your-deployed-origin>/api/auth/callback/google` — add one entry per origin you use (production, any preview URLs, `http://localhost:3000` for local dev). Both variables are server-only.

The Work Tasks card needs a Todoist API token:

```
TODOIST_API_TOKEN=<your-todoist-api-token>
```

Find it under **Settings → Integrations → Developer** in Todoist. Server-only — read inside `src/lib/todoist.ts` and the Server Actions in `src/app/actions/todoist.ts`.

The Health card needs a Whoop OAuth client:

```
WHOOP_CLIENT_ID=<your-whoop-client-id>
WHOOP_CLIENT_SECRET=<your-whoop-client-secret>
```

Create these in the [Whoop Developer Dashboard](https://developer.whoop.com/). The redirect URI registered there must exactly match `<your-deployed-origin>/api/auth/callback/whoop` — add one entry per origin you use (production, any preview URLs, `http://localhost:3000` for local dev). Both variables are server-only.

## Supabase

Supabase client helpers live in `src/lib/supabase/`:

- `client.ts` — browser client for use in Client Components.
- `server.ts` — server client for use in Server Components and Route Handlers.
- `middleware.ts` — refreshes the auth session; wired up in `src/proxy.ts`.

A couple of dashboard widgets (`src/components/dashboard/`) — `HabitsCard`, `FinanceCard` — still render placeholder data. Connect them to Supabase tables as your schema evolves, following the same pattern as the cards below.

### Database Schema

SQL migrations live in `supabase/migrations/`. Apply them either via the [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase db push`) or by pasting the file contents into the SQL Editor in your Supabase project dashboard.

- `20260802000000_create_journal_entries.sql` — creates the `journal_entries` table (`entry_date`, `content`, `created_at`) backing the Journal card.
- `20260802130000_scope_journal_entries_to_user.sql` — adds a `user_id` column and replaces the original open-access policies with ones scoped to `auth.uid()`. **Run this after creating your Supabase user** (Authentication → Users in the dashboard) — it backfills any pre-existing rows to that one account, which only works for a single-user setup.
- `20260802140000_create_workout_tables.sql` — creates `workout_sessions`, `session_exercises`, and `exercise_sets` (one session has many exercises, each exercise has many sets) backing the Weight Training card. RLS is scoped to `auth.uid()` from the start — `workout_sessions` checks `user_id` directly, and the child tables check ownership via the parent session.
- `20260802150000_create_google_calendar_connections.sql` — creates `google_calendar_connections` (one row per user: access token, refresh token, expiry) backing the Upcoming Events card. RLS is scoped to `auth.uid()`, and the table is only ever touched by server-side code — the anon/browser client never reads or writes it.
- `20260803000000_add_workout_session_category.sql` — adds a nullable `category` column to `workout_sessions`, constrained to `Chest`, `Back`, `Shoulder`, or `Leg`. Existing sessions default to `null` (uncategorized) and won't appear under any of the progress-chart tabs.
- `20260803010000_require_workout_session_category.sql` — adds a `not valid` check constraint requiring `category is not null`. `not valid` means it only applies going forward (new inserts and updates) — existing null rows are left alone rather than being force-migrated or rejected retroactively.
- `20260803020000_create_todoist_preferences.sql` — creates `todoist_preferences` (one row per user: `selected_project_ids`) backing the Work Tasks card, so which Todoist project(s) you've chosen persists across visits. RLS is scoped to `auth.uid()`.
- `20260803030000_create_personal_tasks.sql` — creates `personal_tasks` (`content`, `created_at`) backing the Personal Tasks card. RLS is scoped to `auth.uid()` with select/insert/delete policies — completing a task deletes its row rather than flagging it done, since there's no "view completed" feature.
- `20260803040000_create_whoop_connections.sql` — creates `whoop_connections` (one row per user: access token, refresh token, expiry, scope) backing the Health card, following the exact same shape and RLS pattern as `google_calendar_connections`.
- `20260804000000_add_workout_session_delete_policies.sql` — adds delete policies to `workout_sessions`, `session_exercises`, and `exercise_sets`, which previously only had select/insert policies. RLS applies to rows removed via `on delete cascade`, so deleting a session needs delete policies on the child tables too, not just the parent.
- `20260805000000_create_habits.sql` — creates `habits` (`name`, `position`) and `daily_habit_completions` (`habit_id`, `completed_date`, unique per habit+date) backing the Habit Streaks card. RLS on `habits` is scoped to `auth.uid()` directly; `daily_habit_completions` has no `user_id` of its own, so its policies check ownership via a join back to `habits`, same pattern as `session_exercises` → `workout_sessions`. Also seeds the 8 starting habits (single-user assumption, same as the journal migration).
- `20260806000000_create_meal_planning_and_grocery.sql` — creates `meal_plan_entries` (a fixed row per user per day-of-week, upserted in place — never inserted fresh each week or deleted), `grocery_items` (`content`, `checked`), and `grocery_staples` (a separate recurring-item list), all backing the Meal Planning & Grocery List card. RLS is scoped to `auth.uid()` on all three.
- `20260807000000_add_journal_entries_delete_policy.sql` — adds a delete policy to `journal_entries`, which previously only had select/insert policies, so entries can be removed from the Journal card.
- `20260808000000_restructure_meal_plan_for_slots.sql` — restructures `meal_plan_entries` from one upserted-forever row per day into one row per `(week_start_date, day_of_week, meal_slot)`, adding `meal_slot` (Breakfast/Lunch/Dinner), `mode` (Custom/Eating Out/Leftovers), and `leftover_day_of_week` / `leftover_meal_slot` (which slot a Leftovers entry repeats). Backfills existing rows into the Dinner slot of the then-current week, in Custom mode. The old `unique (user_id, day_of_week)` constraint is replaced with `unique (user_id, week_start_date, day_of_week, meal_slot)`, since a day can now have three independent slots across many distinct weeks.
- `20260809000000_create_cleaning_tasks.sql` — creates `cleaning_tasks` (`name`, `frequency` constrained to `weekly`/`biweekly`/`monthly`) and `cleaning_task_completions` (`task_id`, `completed_at` — an append-only log, not a mutable "last done" flag) backing the Routine Cleaning Reminders card. RLS on `cleaning_tasks` is scoped to `auth.uid()` directly; `cleaning_task_completions` has no `user_id` of its own, so its policies check ownership via a join back to `cleaning_tasks`, same pattern as `daily_habit_completions` → `habits`.
- `20260810000000_create_weight_tracker.sql` — creates `weight_goal` (one row per user: `goal_weight`, `target_date`, upserted in place) and `weight_entries` (`entry_date`, `weight`, unique per user+date — logging again for a date overwrites it rather than adding a second entry) backing the Health card's Weight Tracker section. RLS is scoped to `auth.uid()` on both.

### Timezones

Server Components and Server Actions run on the server (UTC on Vercel), not in the browser — any date/time logic that doesn't explicitly account for this ends up using the server's timezone instead of the signed-in user's, which showed up as the header clock and Upcoming Events running hours ahead of local time. Two distinct fixes are used throughout, depending on what's being computed:

1. **Formatting an absolute timestamp for display** (the header's date, event times, the Health card's "As of" line and recovery trend labels): moved into small Client Components so `toLocaleDateString`/`toLocaleTimeString` run in the browser, using its real timezone. Since Next still server-renders Client Components for the initial HTML, naively formatting on first render would still use the server's clock and then visibly (or, worse, silently) mismatch what the browser renders on hydration. Each of these is gated behind `useHasMounted()` (`src/lib/use-has-mounted.ts`, a `useSyncExternalStore`-based "is this the client yet" check) so they render a blank placeholder for the one frame before hydration completes, then the correct local value — avoiding React hydration-mismatch errors entirely rather than letting them happen and self-correct.
2. **Deciding what "today" is for a value being saved** (a new journal entry's `entry_date`, a new workout session's `session_date`): the server can't know the user's local date, so the client computes it (`getLocalDateString()` in `src/lib/date-utils.ts`, which reads local year/month/day — never `.toISOString()`, which gives the UTC date) and sends it explicitly. `JournalCard` sets a hidden field right at submit time; `WorkoutCard`'s save handler includes it directly in the payload. Both Server Actions fall back to computing the date themselves only if the field is missing or malformed.

Also fixed along the way: `new Date("yyyy-mm-dd")` parses bare date strings as UTC midnight, which rolls back a day in negative-offset timezones — `google-calendar-utils.ts`'s `parseEventDate()` constructs an explicit local date for all-day calendar events instead of handing the raw string to `Date` directly. `TasksCardBody.tsx` (Work Tasks) already did this correctly for Todoist due dates and needed no changes; Personal Tasks has no date-dependent display at all.

### Personal Tasks

A simple manual checklist, separate from the Todoist-backed Work Tasks card — nothing here talks to an external API.

- `src/lib/personal-tasks.ts` — `getPersonalTasks()` fetches the signed-in user's tasks oldest-first for Server Components.
- `src/app/actions/personal-tasks.ts` — `addPersonalTask` inserts a new task; `completePersonalTask` deletes it (checking a task off removes it for good, there's no completed-tasks view).
- `src/components/dashboard/PersonalTasksCard.tsx` (Server Component, fetches data) + `PersonalTasksCardBody.tsx` (Client Component) — a text input + Add button, and the task list with checkboxes. Checking a task off removes it immediately (optimistic) and deletes it in the database; on failure it reappears once fresh data loads.

### Journal

- `src/lib/journal.ts` — `getJournalEntries()` fetches entries newest-first for Server Components.
- `src/app/actions/journal.ts` — `addJournalEntry` is a Server Action that inserts a new entry and revalidates the dashboard. `entry_date` comes from a hidden form field the client sets right at submit time (see [Timezones](#timezones)) rather than being computed on the server. `deleteJournalEntry` deletes an entry by id, scoped to the signed-in user (`user_id` check, backed by the delete RLS policy).
- `src/app/actions/transcribe.ts` — `transcribeAudio` is a Server Action that sends an uploaded audio file to OpenAI's Whisper API and returns the transcribed text. Runs entirely server-side so `OPENAI_API_KEY` stays private.
- `src/components/dashboard/JournalCard.tsx` — upload-and-transcribe control, the textarea + save button, and the entry list UI. Past entries are collapsed behind an "Entries (N)" toggle by default (same collapse pattern as Weight Training's Session History), expanding into a scrollable list capped at `max-h-80`. Each entry has a "Delete" button gated behind `window.confirm(...)`; deletion is optimistic (removed from the list immediately, reconciled with the server via `router.refresh()`), with the entry reappearing if the delete fails.

To attach a voice memo: record it on your phone, upload the audio file via the "Upload & Transcribe" control, review/edit the transcribed text that appears in the textarea, then save as usual. Uploads are capped at 25MB (Whisper's own limit) via `serverActions.bodySizeLimit` in `next.config.ts`. Accepted formats: m4a (iPhone Voice Memos' default), mp3, mp4, wav, aac, webm, ogg, and flac — the file's extension is used to set the correct MIME type before it's sent to Whisper, since mobile browsers often report the wrong one.

### Weight Training

- `src/lib/workout-utils.ts` — pure, client-safe types and helpers (`getExerciseNames`, `getOneRepMaxSeries`, `estimateOneRepMax`, the `WORKOUT_CATEGORIES` constant) shared by the server data layer, `WorkoutCard`, and the chart component.
- `src/lib/workouts.ts` — `getWorkoutSessions()` fetches sessions (including `category`) with their nested exercises and sets, newest-first, for Server Components.
- `src/app/actions/workout.ts` — `parseWorkoutText` sends a freeform description to Claude (`claude-opus-5`, structured output via a Zod schema) and returns extracted exercises/sets; `saveWorkoutSession` requires a category (rejecting `null` with a clear error), validates it against `WORKOUT_CATEGORIES`, and inserts the (possibly edited) result into the three tables (`session_date` is sent by the client, see [Timezones](#timezones)); `deleteWorkoutSession` deletes a session, which cascades to its exercises/sets via foreign keys.
- `src/components/dashboard/WorkoutCard.tsx` — the "Quick log" textarea + Parse button, a required category selector (Chest/Back/Shoulder/Leg) alongside the session name field — attempting to save without picking one shows an inline error instead of submitting — an editable exercise/set builder (also usable directly for manual entry — just click "+ Add Exercise" without parsing anything), and the session history list. History is collapsed by default behind a "▸ Session History (N)" toggle; expanding it reveals the list capped at `max-h-96 overflow-y-auto`. Each session has a Delete button (optimistic removal, following the same local-state-synced-from-props pattern as Personal/Work Tasks).
- `src/components/dashboard/ProgressChart.tsx` — four category tabs; the exercise picker and chart below only ever show exercises from sessions in the selected category. Sessions without a category (including everything logged before this feature) don't appear under any tab. Plots an estimated one-rep max (Epley formula: `weight × (1 + reps / 30)`) rather than raw weight — for each session, the "best set" is whichever set produces the *highest estimated 1RM*, which isn't always the set with the most weight or the most reps.

The parsed result is never saved directly — it populates the same editable builder used for manual entry, so you can fix anything (including the category) before it's written to the database. Claude doesn't infer the category from the description; it's always your own selection.

### Work Tasks (Todoist)

- `src/lib/todoist.ts` — server-only: `getTodoistProjects()`, `getTodoistTasksForProjects()`, and `closeTodoistTask()` call the Todoist API directly with `TODOIST_API_TOKEN`; `getSelectedProjectIds()` reads the saved preference from Supabase. List responses are parsed defensively (a flat array or a `{results: [...]}` wrapper, whichever Todoist returns) since the exact response shape wasn't verifiable from this environment — worth confirming against a real account.
- `src/app/actions/todoist.ts` — `saveTodoistProjectSelection` upserts the chosen project IDs; `completeTodoistTask` closes a task in Todoist (via the API, not just locally) and revalidates the dashboard.
- `src/components/dashboard/TasksCard.tsx` (Server Component, fetches data) + `TasksCardBody.tsx` (Client Component, the interactive part) — a project picker (checkboxes, multi-select) shown until you've saved a selection, after that the task list with due dates and checkboxes. Checking a task off removes it immediately (optimistic) and calls Todoist to actually complete it; on failure the task reappears once fresh data loads. A "Change projects" link reopens the picker at any time.

Tasks shown are whatever's currently active (not completed) in the selected project(s). Two tabs split them by due date: **Today** is due-today-or-overdue (compared by calendar date, not exact time); **Future** is everything else, including tasks with no due date at all. Within each tab, dated tasks sort soonest-first and undated tasks sort last. Both tabs cap the visible list height to roughly 5 tasks (`max-h-60`) with a scrollbar for the rest.

### Google Calendar

- `src/app/api/auth/google/route.ts` — starts the OAuth flow: redirects to Google's consent screen with `access_type=offline` + `prompt=consent` (so a refresh token is issued every time, not just on first consent) and a random `state` value stashed in a short-lived, `httpOnly` cookie for CSRF protection.
- `src/app/api/auth/callback/google/route.ts` — verifies `state`, exchanges the authorization code for tokens, and upserts them into `google_calendar_connections` for the signed-in user. Redirects back to the dashboard, adding a `?google_error=...` param on failure (surfaced as an inline message on the Events card).
- `src/lib/google-calendar.ts` — server-only: `isGoogleCalendarConnected()`, `getUpcomingEvents()` (refreshes the access token first if it's expired or about to expire, persisting the new one; fetches up to 20 events rather than just 5, so both grouped sections below have room to be populated), and `revokeGoogleToken()`.
- `src/lib/google-calendar-utils.ts` — pure, client-safe `CalendarEvent` type and helpers (`parseEventDate`, `isSameLocalDay`, `formatEventTime`, `formatEventDate`) shared by the server data layer and `EventsCardBody`.
- `src/app/actions/google-calendar.ts` — `disconnectGoogleCalendar` Server Action: revokes the token with Google and deletes the stored connection.
- `src/components/dashboard/EventsCard.tsx` (Server Component, fetches data + handles connect/disconnect/error states) + `EventsCardBody.tsx` (Client Component) — groups events into **Today** (time only) and **Upcoming** (date + time) by the browser's local calendar day (see [Timezones](#timezones)), presented as tabs — same layout pattern as the Work Tasks card — rather than stacked sections. Each tab's list is capped at ~5 visible items with a scrollbar for the rest.

The Calendar scope requested is read-only (`calendar.readonly`). Tokens are stored as plain columns protected by RLS and are only ever read by server-side code — there's no application-layer encryption on top of that, worth revisiting if this ever stops being a single-user app.

### Authentication

The dashboard requires a signed-in Supabase user — there's no self-serve signup, since this is a single-user app. Create your account directly in the Supabase dashboard (Authentication → Users → Add user), then sign in at `/login` with that email and password.

- `src/lib/supabase/middleware.ts` — redirects unauthenticated requests to `/login`, and signed-in users away from `/login`, on every route.
- `src/app/actions/auth.ts` — `signIn` and `signOut` Server Actions.
- `src/app/login/page.tsx` + `src/components/auth/LoginForm.tsx` — the login form.
- The `addJournalEntry` and `transcribeAudio` Server Actions also check for a signed-in user directly, as defense in depth beyond the route-level redirect.

Sessions persist across browser restarts via Supabase's cookie-based refresh token — signing in once is enough; you won't need to log in again unless you explicitly sign out or the cookies are cleared.

`/privacy` is the one route exempt from the auth gate above — it's public in both directions (no redirect for signed-out visitors, no redirect-away for signed-in ones), since Google's OAuth consent-screen verification needs a privacy policy URL it can reach without logging in.

### Health (Whoop)

- `src/app/api/auth/whoop/route.ts` — starts the OAuth flow: redirects to Whoop's consent screen requesting the `read:recovery read:cycles read:sleep offline` scopes (`offline` is what gets a refresh token issued) and a random `state` value stashed in a short-lived, `httpOnly` cookie for CSRF protection, following the same pattern as the Google Calendar connect route.
- `src/app/api/auth/callback/whoop/route.ts` — verifies `state`, exchanges the authorization code for tokens, and upserts them into `whoop_connections` for the signed-in user. Redirects back to the dashboard, adding a `?whoop_error=...` param on failure (surfaced as an inline message on the Health card).
- `src/lib/whoop-utils.ts` — pure, client-safe types (`HealthSnapshot`, `RecoveryPoint`) and helpers (`formatSleepDuration`, `recoveryColorClass`) shared by the server data layer and the chart component. `RecoveryPoint.timestamp` is a raw ISO instant rather than a pre-bucketed date string (see [Timezones](#timezones)).
- `src/lib/whoop.ts` — server-only: `isWhoopConnected()`, `getHealthSnapshot()` (latest recovery score, sleep summary, and strain, refreshing the access token first if it's expired or about to expire), and `getRecoveryTrend()` (recovery score for the last 7 days).
- `src/app/actions/whoop.ts` — `disconnectWhoop` Server Action: deletes the stored connection. Unlike Google, Whoop's public API has no documented token-revocation endpoint, so there's nothing to call before deleting.
- `src/components/dashboard/HealthCard.tsx` (Server Component, fetches data + handles connect/disconnect/error states) + `HealthCardBody.tsx` (Client Component) — the "Connect Whoop" button when there's no connection, otherwise a compact recovery/sleep/strain snapshot plus the trend chart below it.
- `src/components/dashboard/RecoveryTrendChart.tsx` — a 7-day line chart of recovery score, styled the same way as the Weight Training progress chart (same SVG approach, hover tooltip, and date labels), with a fixed 0-100 y-axis since recovery is always a percentage.

Whoop's API response shapes (recovery/cycle/sleep record fields) are implemented from their public developer docs and parsed defensively (missing/unscored records are treated as "no data" rather than thrown), but weren't verifiable against a live account from this environment — worth double-checking field names against your own data once connected. Tokens are stored as plain columns protected by RLS, same caveat as the Google Calendar connection above.

#### Weight Tracker

A sub-section of the Health card, always shown regardless of whether Whoop is connected — it's the user's own logged data, not something Whoop provides.

- `src/lib/weight-utils.ts` — pure, client-safe types (`WeightEntry`, `WeightGoal`) and the derived-stat math:
  - `computeWeekOverWeekChange(entries, todayLocalDate)` averages this week's entries (Sunday through today) and last week's, returning `null` — rather than a misleading number — if either window has no logged entries at all.
  - `estimateWeeksToGoal(entries, goalWeight, todayLocalDate)` projects forward using the average rate of change since the first entry (total change ÷ weeks elapsed), applied to the remaining gap to the goal. Requires at least 2 entries *and* 14+ days of history — a wide gap between two entries would otherwise produce a wildly unreliable weekly rate — returning `{status: "insufficient_data"}` (surfaced as "Log a few more weeks to see an estimate") until then. Also handles a flat or wrong-direction trend (`{status: "no_progress"}`, e.g. weight went up while trying to lose) rather than showing a negative or infinite number, and a goal that's effectively already been reached (`{status: "already_at_goal"}`). The math itself generalizes to a goal above the current weight (gaining) as well as below it (losing), even though the rate is always framed as "closing the gap," not literally "rate of loss."
  - Both functions depend on the browser's local "today" (a week boundary is exactly the kind of thing that can land on the wrong side of the server/browser timezone gap — see [Timezones](#timezones)), so `WeightTrackerSection` computes them client-side, gated behind `useHasMounted()`, against data fetched server-side as plain props — same architecture as Habit Streaks' streak math, not the client-refetch approach Meal Plan needed (there's no "which week to query from the database" decision here — all entries are fetched once, and the week-bucketing is just local arithmetic over already-loaded data).
- `src/lib/weight.ts` — server-only `getWeightEntries()` (ascending by date) and `getWeightGoal()` (the single per-user row, or `null`).
- `src/app/actions/weight.ts` — `addWeightEntry` (upserts onto `(user_id, entry_date)` — logging again for a date overwrites it rather than creating a second entry), `deleteWeightEntry`, and `updateWeightGoal(goalWeight, targetDate)` (upserts onto `user_id`).
- `src/components/dashboard/WeightTrackerSection.tsx` — a goal form (weight + target date) and a log-weight form side by side, the week-over-week indicator (▲ red if gained, ▼ green if lost, "—" if unchanged, to 1 decimal place) and the time-to-goal estimate below that, the trend chart, then a collapsed-by-default history list (same `▸`/`▾` toggle pattern as Journal and Weight Training) with a Delete button per entry. The log-weight date field is an *uncontrolled* input (like Journal's date field) defaulting to today via a ref set in a mount effect, rather than React state — resetting controlled state inside the post-submit effect would trip the project's `react-hooks/set-state-in-effect` rule, while a plain DOM mutation on a ref doesn't.
- `src/components/dashboard/WeightTrendChart.tsx` — styled the same way as the Weight Training progress chart and the Whoop recovery chart (SVG line chart, hover tooltip, date labels), plus a dashed amber reference line at the goal weight. The value range used for the y-axis includes the goal weight (not just the logged data), with a little padding, so the reference line is never clipped against the plot's edge even if the goal is above or below every logged entry so far.

Checking the math against hand-worked cases (a losing trend, a gaining trend toward a higher goal, a flat trend, and a trend moving the wrong direction) confirmed the "no_progress" branch is reached instead of a nonsensical number whenever the trend doesn't support a projection.

### Habit Streaks

A fully custom habit tracker, replacing the original hardcoded placeholder — add/rename/delete habits, reorder them manually (up/down arrows, no drag-and-drop library), check them off per day, and see a running streak, best streak ever, and a 30-day chain calendar per habit.

- `src/lib/habit-utils.ts` — pure, client-safe types and the streak/calendar math:
  - `computeHabitStreaks(habit, todayLocalDate)` implements the lenient streak rule: **within any rolling 7-day window, one missed day is forgiven; a second missed day in that same window resets the streak to 0** (and the window itself resets, so the two miss-days that caused the break don't keep forcing resets for another week). A forgiven miss day doesn't interrupt the streak count — the counter keeps incrementing through it, the same way a "streak freeze" works in other habit trackers. A not-yet-completed "today" is never judged as a miss; it's simply excluded from the evaluated range until it's actually marked done or the day passes. `best` is the highest the streak counter ever reached, computed from the same scan. The evaluated range starts at the habit's `created_at`, converted to a **local** calendar date via `getLocalDateString(new Date(habit.created_at))` — an earlier version sliced the raw UTC-serialized timestamp directly, which could land on "tomorrow" relative to the user's local date for a habit created in the evening in a negative-offset timezone, making the range start after today and permanently stranding the streak at `0` no matter what got checked off.
  - `getChainCalendar(habit, todayLocalDate, days = 30)` returns the last 30 local calendar days (oldest first) with a `done` flag each, for the dot grid. Days before the habit existed just show as not-done (no separate "N/A" state).
  - All date math is done as `"yyyy-mm-dd"` string arithmetic via a local `addDays` helper — never through `Date`'s UTC-based parsing — since streaks and the chain calendar both depend on the browser's local calendar day (see [Timezones](#timezones)).
- `src/lib/habits.ts` — server-only `getHabits()`: fetches habits ordered by `position` with their nested completions, for the Server Component.
- `src/app/actions/habits.ts` — `addHabit` (appends at the end, `position = max + 1`), `renameHabit`, `deleteHabit` (cascades to its completions), `reorderHabit(habitId, "up" | "down")` (swaps `position` with the immediate neighbor — no bulk reorder endpoint, since the UI only ever moves one habit one step at a time), `setHabitCompletion(habitId, date, completed)` (upserts or deletes a `daily_habit_completions` row).
- `src/components/dashboard/HabitsCard.tsx` (Server Component, fetches data) + `HabitsCardBody.tsx` (Client Component) — the add-habit form, and the habit list. Streaks and the chain calendar are computed client-side against the browser's local date (mount-gated via `useHasMounted()`, same pattern as the timezone fixes elsewhere) rather than server-side, for the same reason: a Server Component can't know the user's real local "today". Each row: reorder arrows, a checkbox for today, the name (click to rename inline), a `🔥current · best N` badge, a delete button, and a row of 30 small dots (filled = done) underneath. Capped at `max-h-96 overflow-y-auto`, roughly 5 habits visible before scrolling, in the order you've set.

Toggling, reordering, renaming, and deleting are all optimistic (the UI updates immediately, then reconciles with the server) following the same local-state-synced-from-props pattern used by Personal/Work Tasks and Weight Training's session delete.

I verified the streak algorithm against a set of hand-worked cases (a single break within one window, two misses spaced more than 7 days apart correctly *not* compounding, and the two-miss-in-one-window reset) before wiring it into the UI — all matched the intended behavior exactly.

### Routine Cleaning Reminders

A simple recurring checklist — no streaks, no chain calendar, just "is this task due yet." Add cleaning tasks (Vacuum, Clean bathroom, Deep clean fridge, …), each with a frequency of Weekly, Biweekly, or Monthly; a task becomes checkable again once its interval has passed since it was last marked done.

- `src/lib/cleaning-utils.ts` — pure, client-safe types and the due-status math. `CLEANING_FREQUENCY_INTERVAL_DAYS` maps each frequency to a fixed day count (7/14/30) rather than a calendar-aware interval like "the same day next month" — simpler, and matches "just a simple recurring checklist." `computeCleaningStatus(task, lastCompletedAt, now)` compares elapsed *real time* since the last completion against that interval (`now.getTime() - new Date(lastCompletedAt).getTime() >= intervalDays * dayMs`) rather than comparing calendar-day strings — an instant diff is timezone-independent (a millisecond is the same duration everywhere), unlike the "is it a new local day yet" checks the rest of this app has had to be careful about (see [Timezones](#timezones)). That means due/not-due status is safe to compute on the server, with no client-side correction step needed, unlike Habit Streaks, Meal Plan, or the Health card. It also returns `nextDueAt` (`lastCompletedAt` plus the interval, as an ISO instant) for every completed task, used by the Recently Completed section below. `isCleaningTaskVisible(task, withinDays = 7)` is the visibility filter described below — overdue (any amount) or due within the window.
- `src/lib/cleaning.ts` — server-only `getCleaningTasks()`: fetches tasks with their nested completions, takes the most recent `completed_at` per task, and runs it through `computeCleaningStatus`. Returns the *full* list, unfiltered — visibility filtering happens in the UI layer (see below), not here.
- `src/app/actions/cleaning.ts` — `addCleaningTask` (form action), `renameCleaningTask`, `updateCleaningTaskFrequency`, `deleteCleaningTask` (cascades to its completions), and `setCleaningTaskCompletion(taskId, completed)`. Marking a task done *inserts* a new row into `cleaning_task_completions` (an append-only log, not a mutable flag); unchecking it deletes only the most recent completion, as an undo for an accidental check.
- `src/components/dashboard/CleaningCard.tsx` (Server Component, fetches data) + `CleaningCardBody.tsx` (Client Component) — an add-task form (name + frequency), then the task list: a checkbox (checked = not due), the name (click to rename inline, same pattern as Habit Streaks), a frequency `<select>` that saves immediately on change, a delete button, and a status line ("Due now — done 9d ago" / "Not due yet — done 3d ago, due in 4d" / "Due now — never done"). Capped at `max-h-72 overflow-y-auto`.

Checking a task off is optimistic like everywhere else in this app, with one caveat: since the client doesn't track full completion history (only the derived due/not-due status), an optimistic uncheck approximates the result as "never done" rather than restoring the exact prior completion — `router.refresh()` immediately after reconciles it with whatever the server actually has on record.

Only tasks that are overdue (any amount) or due within the next 7 days are actually rendered — `CleaningCardBody` filters `localTasks` down to `visibleTasks` via `isCleaningTaskVisible` right before rendering the list, while every handler (toggle, rename, frequency change, delete) still operates on the full `localTasks` array. Hidden tasks aren't deleted or archived anywhere — they still exist and still get fetched on every load; they just don't pass the filter yet. Since visibility is recomputed fresh from `computeCleaningStatus` on every render (not stored as a flag), a task quietly reappears on its own once it drifts inside the 7-day window, with no separate "check for newly-due tasks" step needed. If every task is currently outside the window, the list shows "Nothing due or coming up in the next 7 days." instead of an empty list indistinguishable from having no tasks at all.

A collapsed-by-default "Recently completed" section sits below the main list — same `▸`/`▾` toggle pattern as Weight Tracker's History and Weight Training's Session History — showing exactly the complement of `visibleTasks` that's also been completed at least once (i.e. everything hidden by the filter above, minus tasks that have simply never been done, which show up as "Due now" in the main list instead). This only ever has entries for Biweekly or Monthly tasks in practice: a Weekly task's 7-day interval exactly matches the 7-day visibility window, so a freshly-checked Weekly task is already right at the edge of that window the moment it's checked and never actually leaves it. Expanding the section lists each task's name and its `nextDueAt`, formatted client-side (mount-gated, like every other absolute-timestamp display in this app — see [Timezones](#timezones)) since it's a real instant, not a date-only string. Sorted soonest-due-first, capped at `max-h-60 overflow-y-auto`.

### Meal Planning & Grocery List

A wide card, directly below Habit Streaks: a weekly meal plan (Breakfast/Lunch/Dinner per day) on the left, an active grocery list plus a recurring "staples" list on the right.

- `src/lib/meal-plan-utils.ts` — the `DAYS_OF_WEEK` (Sunday first) and `MEAL_SLOTS` (`breakfast`/`lunch`/`dinner`) constants, the `MealMode` type (`"custom" | "eating_out" | "leftovers"`) and its display labels, and the client-safe `MealPlanEntry` type. `getWeekStartDate(localDateStr)` returns the Sunday starting the week containing a given local date; `getPreviousWeekStartDate` subtracts 7 days from that. All date math is `"yyyy-mm-dd"` string arithmetic via a local `addDays` helper, never through `Date`'s UTC-based parsing — the same pattern used throughout the app (see [Timezones](#timezones)), since a week boundary is exactly the kind of thing that can land on the wrong side of the server/browser timezone gap.
- `src/lib/meal-plan.ts` — server-only `getMealPlanForWeek(weekStartDate)`. Always returns exactly 21 entries (7 days × 3 slots), filling in `custom`/empty defaults for any slot that doesn't have a row yet for that particular week.
- `src/app/actions/meal-plan.ts` — `fetchMealPlanForWeek` (a plain callable, not a form action — see below), `updateMealPlanEntry` (upserts one slot onto `(user_id, week_start_date, day_of_week, meal_slot)`; clears `content` when the mode isn't Custom and clears the leftover reference when the mode isn't Leftovers, so stale data doesn't linger under an inactive mode), `copyPreviousWeek` (reads the previous week's entries, upserts every non-empty one into the current week, and returns the refreshed grid — a no-op error if last week was entirely empty), and `parseMealIngredients` (sends a meal's text to Claude, `claude-opus-5`, structured output via a Zod schema, returning a short list of likely grocery items).
- `src/components/dashboard/MealPlanSection.tsx` — renders immediately from a server-provided best guess at the current week (`initialWeekStartDate`/`initialEntries`, computed using the server's effectively-UTC clock — same "render a reasonable default, silently upgrade" pattern as `WeatherWidget`'s Charlotte fallback), then on mount compares that guess against the browser's real local week and, only if they differ, calls `fetchMealPlanForWeek` once to correct it — no loading flash in the common case, no network round-trip before the grid can render. Each of the 21 slots has a mode `<select>` (Custom/Eating Out/Leftovers) plus, depending on the mode: a text field (Custom, saved on blur) with a 🛒 button next to it, a plain "Eating Out" badge, or a second `<select>` listing every other slot in the week (Leftovers — e.g. "Monday Dinner"). "Copy previous week" duplicates last week's full plan (mode, content, and leftover references) into the current week as an editable starting point. The 🛒 button opens an inline ingredient-parsing preview below that slot: Claude's suggested ingredients appear as editable text rows (add/remove any of them) with "Add to Grocery List" and "Cancel"/"Close" buttons, so nothing is added to the grocery list without a chance to review it first.
- `src/lib/grocery-utils.ts` — client-safe `GroceryItem`/`GroceryStaple` types.
- `src/lib/grocery.ts` — server-only `getGroceryItems()` and `getGroceryStaples()`, both ordered oldest-first.
- `src/app/actions/grocery.ts` — `addGroceryItem` / `addGroceryStaple` (form actions), `toggleGroceryItem` (flips `checked`, doesn't delete), `clearCheckedGroceryItems` (bulk-deletes everything checked — the only way checked items are removed), `deleteGroceryStaple`, `addStapleToGroceryList` (a plain callable — not a form action — sharing the same insert as `addGroceryItem`, used by the staple quick-add chips), and `addItemsToGroceryList` (bulk insert, used by the meal plan's ingredient-parsing preview to add several items in one call).
- `src/components/dashboard/GroceryListSection.tsx` — staple chips at the top (tap the chip text to quick-add it to the list below; the small ✕ removes it from your staples, not from the active list, plus a compact inline "Add staple" field), then the manual add-item form, then the list itself. Checked items get a strikethrough and stay in place — they only disappear via the "Clear checked" button, which only appears once something is checked. Capped at `max-h-60 overflow-y-auto`. All mutations (toggle, quick-add, clear-checked, delete-staple) are optimistic, same local-state-synced-from-props pattern as Habit Streaks and Personal/Work Tasks.
- `src/components/dashboard/MealPlanGroceryCard.tsx` — the Server Component wrapper (`lg:col-span-3`, full-width) that fetches the server's best-guess current week's meal plan plus both grocery data sources in parallel, and lays out the two sections side by side.

The ingredient list Claude suggests is never added to the grocery list directly — it always lands in the editable preview first, mirroring how Weight Training's Claude-parsed workout populates an editable builder rather than saving straight to the database.

### Weather

A compact weather widget lives in the dashboard header, next to the date/email/Sign Out controls. No API key or database table required — it's a live fetch to [Open-Meteo](https://open-meteo.com) on every page load. Desktop always shows Charlotte, NC; mobile tries to upgrade to the device's actual location.

- `src/lib/weather-utils.ts` — pure, client-safe types (`WeatherSnapshot`, `HourlyForecast`) and a WMO weather-code → emoji/label lookup (`getWeatherIcon`, `getWeatherLabel`), plus `formatHour`.
- `src/lib/weather.ts` — `getWeatherSnapshot(latitude?, longitude?)` fetches current conditions, today's high/low, and the next 12 hours from Open-Meteo's `/v1/forecast` endpoint (`cache: "no-store"` so it's always fresh; `timezone=auto` so hours line up correctly regardless of which coordinates were passed in). Defaults to Charlotte, NC when called with no arguments. Has no server-only dependencies, so it's called from both the Header Server Component (the default Charlotte snapshot) and directly from the client (the geolocation snapshot). Returns `null` on any failure so callers can show a quiet fallback instead of crashing.
- `src/components/dashboard/WeatherWidget.tsx` — a Client Component: the compact icon + temp button, and a dropdown panel (high/low + scrollable hourly forecast) that opens on click and closes on an outside click or a second click. On mount, if `window.innerWidth < 768` or the user agent looks mobile, it calls the browser's Geolocation API; on success it re-fetches the snapshot for those coordinates and swaps the panel's location label to "Your location". Desktop skips this check entirely and never touches geolocation. A `weather-geo-permission` flag in `localStorage` (`"granted"` / `"denied"`) remembers the outcome so a past denial is never retried — subsequent mobile loads just stay on the Charlotte fallback without asking again.
- `src/components/dashboard/Header.tsx` — calls `getWeatherSnapshot()` (Server Component, no args → Charlotte) for the SSR'd initial state passed into `WeatherWidget` as `initialSnapshot`. The date shown next to the title is `HeaderDate.tsx`, a small Client Component — see [Timezones](#timezones) for why that's not computed directly in `Header.tsx`.

Like the Whoop integration, Open-Meteo's response shape is implemented from their public docs and wasn't reachable from this sandbox to verify live (their domain is blocked by this environment's outbound proxy). The mobile/geolocation logic itself was verified with a headless-browser test that mocks `navigator.geolocation` and the Open-Meteo network response — confirmed desktop never calls geolocation, a granted mobile location correctly re-fetches and relabels, and a denied one falls back to Charlotte and stays denied across a reload — but still worth a quick real-device check once deployed.

## Deploying to Vercel

1. Push this repository to GitHub (or your Git provider of choice).
2. Import the project into [Vercel](https://vercel.com/new).
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TODOIST_API_TOKEN`, `WHOOP_CLIENT_ID`, and `WHOOP_CLIENT_SECRET` as Environment Variables in the Vercel project settings.
4. Deploy. Vercel will detect the Next.js framework automatically.
5. In Google Cloud Console, make sure `https://<your-vercel-domain>/api/auth/callback/google` is registered as an authorized redirect URI for the OAuth client.
6. In the Whoop Developer Dashboard, make sure `https://<your-vercel-domain>/api/auth/callback/whoop` is registered as a redirect URI for the OAuth client.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
