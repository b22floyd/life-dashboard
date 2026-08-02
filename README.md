# Life Dashboard

A personal life dashboard built with Next.js, Tailwind CSS, and Supabase — tasks, habits, upcoming events, notes, and a finance snapshot in one place.

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

## Supabase

Supabase client helpers live in `src/lib/supabase/`:

- `client.ts` — browser client for use in Client Components.
- `server.ts` — server client for use in Server Components and Route Handlers.
- `middleware.ts` — refreshes the auth session; wired up in `src/proxy.ts`.

The dashboard widgets (`src/components/dashboard/`) currently render placeholder data. Connect them to Supabase tables as your schema evolves — for example, a `tasks` table for `TasksCard`, a `habits` table for `HabitsCard`, and so on.

## Deploying to Vercel

1. Push this repository to GitHub (or your Git provider of choice).
2. Import the project into [Vercel](https://vercel.com/new).
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as Environment Variables in the Vercel project settings, using your Supabase project's values.
4. Deploy. Vercel will detect the Next.js framework automatically.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
