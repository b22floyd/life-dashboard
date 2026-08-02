# Life Dashboard

A personal life dashboard built with Next.js, Tailwind CSS, and Supabase — tasks, habits, upcoming events, a daily journal, and a finance snapshot in one place.

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

## Supabase

Supabase client helpers live in `src/lib/supabase/`:

- `client.ts` — browser client for use in Client Components.
- `server.ts` — server client for use in Server Components and Route Handlers.
- `middleware.ts` — refreshes the auth session; wired up in `src/proxy.ts`.

Most dashboard widgets (`src/components/dashboard/`) currently render placeholder data. Connect them to Supabase tables as your schema evolves — for example, a `tasks` table for `TasksCard`, a `habits` table for `HabitsCard`, and so on. The Journal card is already wired up end-to-end (see below).

### Database Schema

SQL migrations live in `supabase/migrations/`. Apply them either via the [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase db push`) or by pasting the file contents into the SQL Editor in your Supabase project dashboard.

- `20260802000000_create_journal_entries.sql` — creates the `journal_entries` table (`entry_date`, `content`, `created_at`) backing the Journal card. RLS is enabled with permissive read/insert policies since the app has no authentication yet; tighten these once you add auth.

### Journal

- `src/lib/journal.ts` — `getJournalEntries()` fetches entries newest-first for Server Components.
- `src/app/actions/journal.ts` — `addJournalEntry` is a Server Action that inserts a new entry and revalidates the dashboard.
- `src/app/actions/transcribe.ts` — `transcribeAudio` is a Server Action that sends an uploaded audio file to OpenAI's Whisper API and returns the transcribed text. Runs entirely server-side so `OPENAI_API_KEY` stays private.
- `src/components/dashboard/JournalCard.tsx` — upload-and-transcribe control, the textarea + save button, and the entry list UI.

To attach a voice memo: record it on your phone, upload the audio file via the "Upload & Transcribe" control, review/edit the transcribed text that appears in the textarea, then save as usual. Uploads are capped at 25MB (Whisper's own limit) via `serverActions.bodySizeLimit` in `next.config.ts`.

## Deploying to Vercel

1. Push this repository to GitHub (or your Git provider of choice).
2. Import the project into [Vercel](https://vercel.com/new).
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as Environment Variables in the Vercel project settings, using your Supabase project's values.
4. Deploy. Vercel will detect the Next.js framework automatically.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
