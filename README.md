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

## Supabase

Supabase client helpers live in `src/lib/supabase/`:

- `client.ts` — browser client for use in Client Components.
- `server.ts` — server client for use in Server Components and Route Handlers.
- `middleware.ts` — refreshes the auth session; wired up in `src/proxy.ts`.

Most dashboard widgets (`src/components/dashboard/`) currently render placeholder data. Connect them to Supabase tables as your schema evolves — for example, a `tasks` table for `TasksCard`, a `habits` table for `HabitsCard`, and so on. The Journal card is already wired up end-to-end (see below).

### Database Schema

SQL migrations live in `supabase/migrations/`. Apply them either via the [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase db push`) or by pasting the file contents into the SQL Editor in your Supabase project dashboard.

- `20260802000000_create_journal_entries.sql` — creates the `journal_entries` table (`entry_date`, `content`, `created_at`) backing the Journal card.
- `20260802130000_scope_journal_entries_to_user.sql` — adds a `user_id` column and replaces the original open-access policies with ones scoped to `auth.uid()`. **Run this after creating your Supabase user** (Authentication → Users in the dashboard) — it backfills any pre-existing rows to that one account, which only works for a single-user setup.
- `20260802140000_create_workout_tables.sql` — creates `workout_sessions`, `session_exercises`, and `exercise_sets` (one session has many exercises, each exercise has many sets) backing the Weight Training card. RLS is scoped to `auth.uid()` from the start — `workout_sessions` checks `user_id` directly, and the child tables check ownership via the parent session.
- `20260802150000_create_google_calendar_connections.sql` — creates `google_calendar_connections` (one row per user: access token, refresh token, expiry) backing the Upcoming Events card. RLS is scoped to `auth.uid()`, and the table is only ever touched by server-side code — the anon/browser client never reads or writes it.
- `20260803000000_add_workout_session_category.sql` — adds a nullable `category` column to `workout_sessions`, constrained to `Chest`, `Back`, `Shoulder`, or `Leg`. Existing sessions default to `null` (uncategorized) and won't appear under any of the progress-chart tabs.

### Journal

- `src/lib/journal.ts` — `getJournalEntries()` fetches entries newest-first for Server Components.
- `src/app/actions/journal.ts` — `addJournalEntry` is a Server Action that inserts a new entry and revalidates the dashboard.
- `src/app/actions/transcribe.ts` — `transcribeAudio` is a Server Action that sends an uploaded audio file to OpenAI's Whisper API and returns the transcribed text. Runs entirely server-side so `OPENAI_API_KEY` stays private.
- `src/components/dashboard/JournalCard.tsx` — upload-and-transcribe control, the textarea + save button, and the entry list UI.

To attach a voice memo: record it on your phone, upload the audio file via the "Upload & Transcribe" control, review/edit the transcribed text that appears in the textarea, then save as usual. Uploads are capped at 25MB (Whisper's own limit) via `serverActions.bodySizeLimit` in `next.config.ts`. Accepted formats: m4a (iPhone Voice Memos' default), mp3, mp4, wav, aac, webm, ogg, and flac — the file's extension is used to set the correct MIME type before it's sent to Whisper, since mobile browsers often report the wrong one.

### Weight Training

- `src/lib/workout-utils.ts` — pure, client-safe types and helpers (`getExerciseNames`, `getMaxWeightSeries`, the `WORKOUT_CATEGORIES` constant) shared by the server data layer, `WorkoutCard`, and the chart component.
- `src/lib/workouts.ts` — `getWorkoutSessions()` fetches sessions (including `category`) with their nested exercises and sets, newest-first, for Server Components.
- `src/app/actions/workout.ts` — `parseWorkoutText` sends a freeform description to Claude (`claude-opus-5`, structured output via a Zod schema) and returns extracted exercises/sets; `saveWorkoutSession` validates the category against `WORKOUT_CATEGORIES` and inserts the (possibly edited) result into the three tables.
- `src/components/dashboard/WorkoutCard.tsx` — the "Quick log" textarea + Parse button, a category selector (Chest/Back/Shoulder/Leg, optional) alongside the session name field, an editable exercise/set builder (also usable directly for manual entry — just click "+ Add Exercise" without parsing anything), and the session history list.
- `src/components/dashboard/ProgressChart.tsx` — four category tabs; the exercise picker and chart below only ever show exercises from sessions in the selected category. Sessions without a category (including everything logged before this feature) don't appear under any tab.

The parsed result is never saved directly — it populates the same editable builder used for manual entry, so you can fix anything (including the category) before it's written to the database. Claude doesn't infer the category from the description; it's always your own selection.

### Google Calendar

- `src/app/api/auth/google/route.ts` — starts the OAuth flow: redirects to Google's consent screen with `access_type=offline` + `prompt=consent` (so a refresh token is issued every time, not just on first consent) and a random `state` value stashed in a short-lived, `httpOnly` cookie for CSRF protection.
- `src/app/api/auth/callback/google/route.ts` — verifies `state`, exchanges the authorization code for tokens, and upserts them into `google_calendar_connections` for the signed-in user. Redirects back to the dashboard, adding a `?google_error=...` param on failure (surfaced as an inline message on the Events card).
- `src/lib/google-calendar.ts` — server-only: `isGoogleCalendarConnected()`, `getUpcomingEvents()` (refreshes the access token first if it's expired or about to expire, persisting the new one), and `revokeGoogleToken()`.
- `src/app/actions/google-calendar.ts` — `disconnectGoogleCalendar` Server Action: revokes the token with Google and deletes the stored connection.
- `src/components/dashboard/EventsCard.tsx` — shows a "Connect Google Calendar" button when there's no connection, otherwise the next few events plus a "Disconnect" link.

The Calendar scope requested is read-only (`calendar.readonly`). Tokens are stored as plain columns protected by RLS and are only ever read by server-side code — there's no application-layer encryption on top of that, worth revisiting if this ever stops being a single-user app.

### Authentication

The dashboard requires a signed-in Supabase user — there's no self-serve signup, since this is a single-user app. Create your account directly in the Supabase dashboard (Authentication → Users → Add user), then sign in at `/login` with that email and password.

- `src/lib/supabase/middleware.ts` — redirects unauthenticated requests to `/login`, and signed-in users away from `/login`, on every route.
- `src/app/actions/auth.ts` — `signIn` and `signOut` Server Actions.
- `src/app/login/page.tsx` + `src/components/auth/LoginForm.tsx` — the login form.
- The `addJournalEntry` and `transcribeAudio` Server Actions also check for a signed-in user directly, as defense in depth beyond the route-level redirect.

Sessions persist across browser restarts via Supabase's cookie-based refresh token — signing in once is enough; you won't need to log in again unless you explicitly sign out or the cookies are cleared.

## Deploying to Vercel

1. Push this repository to GitHub (or your Git provider of choice).
2. Import the project into [Vercel](https://vercel.com/new).
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` as Environment Variables in the Vercel project settings.
4. Deploy. Vercel will detect the Next.js framework automatically.
5. In Google Cloud Console, make sure `https://<your-vercel-domain>/api/auth/callback/google` is registered as an authorized redirect URI for the OAuth client.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
